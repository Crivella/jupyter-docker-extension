package workload

import (
	"context"
	"io"
	"strconv"
	"strings"
	"bytes"
	
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/sirupsen/logrus"
)

type GPU struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Available bool   `json:"available"`
}

func (m *Manager) HasGPU(ctx context.Context) (bool, error) {
	info, err := m.cli.Info(ctx)
	if err != nil {
		return false, err
	}

	_, ok := info.Runtimes["nvidia"]

	return ok, nil
}

func (m *Manager) ListGPUs(ctx context.Context) ([]GPU, error) {

	// CUDA probe image (small + standard)
	imageName := "nvidia/cuda:12.4.1-base-ubuntu22.04"

	// Ensure image exists
	_, err := m.cli.ImagePull(ctx, imageName, image.PullOptions{})
	if err == nil {
		// drain stream (required)
		// ignore output safely
		defer func() {}()
	}
	logrus.Infof("Pulled image %s for GPU detection", imageName)
	hostConfig := &container.HostConfig{}
	hostConfig.DeviceRequests = []container.DeviceRequest{
		{
			Driver:       "nvidia",
			Count:        -1,
			Capabilities: [][]string{{"gpu"}},
		},
	}
	// Create container that lists GPUs
	logrus.Infof("Creating container to probe GPUs")
	resp, err := m.cli.ContainerCreate(
		ctx,
		&container.Config{
			Image: imageName,
			Cmd:   []string{"nvidia-smi", "-L"},
			Tty:   false,
		},
		hostConfig,
		nil,
		nil,
		"gpu-probe-temp",
	)
	if err != nil {
		// no GPU runtime available
		return []GPU{
			{ID: "cpu", Name: "CPU only", Available: true},
		}, nil
	}

	defer m.cli.ContainerRemove(ctx, resp.ID, container.RemoveOptions{
		Force: true,
	})

	if err := m.cli.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		return nil, err
	}

	statusCh, errCh := m.cli.ContainerWait(ctx, resp.ID, container.WaitConditionNotRunning)
	logrus.Infof("Waiting for GPU probe container to finish")

	select {
		case <-statusCh:
		case err := <-errCh:
			if err != nil {
				return nil, err
			}
		case <-ctx.Done():
			return nil, ctx.Err()
	}

	logs, err := m.cli.ContainerLogs(ctx, resp.ID, container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
	})
	logrus.Infof("GPU probe container finished, reading logs")
	logrus.Infof("GPU probe container logs: %v", logs)
	if err != nil {
		return nil, err
	}
	defer logs.Close()

	buf := new(bytes.Buffer)
	_, _ = io.Copy(buf, logs)
	logrus.Infof("GPU probe container logs: %s", buf.String())

	output := buf.String()

	// Parse output like:
	// GPU 0: NVIDIA RTX 4090 (UUID: GPU-xxx)
	lines := strings.Split(output, "\n")

	var gpus []GPU

	// TODO: Improve parsing with regex (remove initial stuff and get ID from line such as "GPU XXX: ...")
	for i, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		logrus.Infof("Detected GPU: %s", line)
		gpus = append(gpus, GPU{
			ID:        strconv.Itoa(i),
			Name:      line,
			Available: true,
		})
	}

	if len(gpus) == 0 {
		return []GPU{
			{ID: "cpu", Name: "CPU only", Available: true},
		}, nil
	}

	return gpus, nil
}
