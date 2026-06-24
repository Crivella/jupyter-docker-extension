package workload

import (
	"context"
	"log"
	"fmt"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/go-connections/nat"
)

const (
	JupyterContainerName = "jupyter-runtime"
	JupyterImage         = "ghcr.io/ai-transpwood/eessi_jupyterlab:0.1.6"
)

func (m *Manager) StartJupyter(ctx context.Context, gpu string) error {

	useGPU := gpu != "cpu"

	reader, err := m.cli.ImagePull(
		ctx,
		JupyterImage,
		image.PullOptions{},
	)
	if err == nil {
		defer reader.Close()
	}

	// ---- PORT BINDINGS (THIS IS THE IMPORTANT PART)
	portBindings := nat.PortMap{
		"8888/tcp": []nat.PortBinding{
			{
				HostIP:   "0.0.0.0",
				HostPort: "0", // random host port
			},
		},
		"5000/tcp": []nat.PortBinding{
			{
				HostIP:   "0.0.0.0",
				HostPort: "0", // random host port
			},
		},
	}

	exposedPorts := nat.PortSet{
		"8888/tcp": struct{}{},
		"5000/tcp": struct{}{},
	}

	// -------------------------
	// VOLUMES
	// -------------------------
	volumeBindings := []string{
		"cvmfs-cache:/cvmfs-cache",
		"jupyter_data:/home/eessi-user",
	}

	// -------------------------
	// HOST CONFIG
	// -------------------------
	hostConfig := &container.HostConfig{
		PortBindings: portBindings,

		// REQUIRED: privileged mode
		Privileged: true,

		// volumes
		Binds: volumeBindings,
	}

	// -------------------------
	// GPU SUPPORT
	// -------------------------
	if useGPU {
		log.Println("GPU requested, enabling GPU support for Jupyter container")
		hostConfig.DeviceRequests = []container.DeviceRequest{
			{
				Driver:       "nvidia",
				Count:        1,
				Capabilities: [][]string{{"gpu"}},
				DeviceIDs:    []string{gpu},
			},
		}
	}

	// -------------------------
	// CONTAINER CREATE
	// -------------------------
	resp, err := m.cli.ContainerCreate(
		ctx,
		&container.Config{
			Image: JupyterImage,
			ExposedPorts: exposedPorts,
		},
		hostConfig,
		&network.NetworkingConfig{},
		nil,
		JupyterContainerName,
	)

	if err != nil {
		return err
	}

	// -------------------------
	// START CONTAINER
	// -------------------------
	return m.cli.ContainerStart(
		ctx,
		resp.ID,
		container.StartOptions{},
	)
}

// func (m *Manager) EnsureJupyter(ctx context.Context) error {

// 	containers, err := m.cli.ContainerList(
// 		ctx,
// 		container.ListOptions{
// 			All: true,
// 		},
// 	)

// 	if err != nil {
// 		return err
// 	}

// 	for _, c := range containers {

// 		for _, name := range c.Names {

// 			if name == "/"+JupyterContainerName {

// 				if c.State != "running" {
// 					return m.cli.ContainerStart(
// 						ctx,
// 						c.ID,
// 						container.StartOptions{},
// 					)
// 				}

// 				return nil
// 			}
// 		}
// 	}

// 	gpu, err := m.HasGPU(ctx)

// 	if err != nil {
// 		return err
// 	}

// 	return m.StartJupyter(ctx, gpu)
// }

func (m *Manager) JupyterRunning(ctx context.Context) bool {

	inspect, err := m.cli.ContainerInspect(
		ctx,
		JupyterContainerName,
	)

	if err != nil {
		return false
	}

	return inspect.State != nil &&
		inspect.State.Running
}

func (m *Manager) JupyterInternalIP(ctx context.Context) (string, error) {
	inspect, err := m.cli.ContainerInspect(ctx, JupyterContainerName)
	if err != nil {
		return "", err
	}

	// Most common network: bridge
	if inspect.NetworkSettings == nil {
		return "", fmt.Errorf("no network settings found")
	}

	// Try default bridge network first
	if ip := inspect.NetworkSettings.IPAddress; ip != "" {
		return ip, nil
	}

	// Fallback: iterate networks (more robust)
	for _, network := range inspect.NetworkSettings.Networks {
		if network.IPAddress != "" {
			return network.IPAddress, nil
		}
	}

	return "", fmt.Errorf("no IP address found for container %s", JupyterContainerName)
}
