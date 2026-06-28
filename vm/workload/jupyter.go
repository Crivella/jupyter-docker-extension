package workload

import (
	"io"
	"os"
	"context"
	"log"
	"fmt"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/go-connections/nat"
)

const (
	JupyterContainerName = "AITW-eessi-jupyter-runtime"
	JupyterImage         = "ghcr.io/ai-transpwood/eessi_jupyterlab:0.1.6"
	JupyterUser		     = "eessi-user"
)

var requiredPorts = map[string]nat.PortBinding{
	"8888/tcp": {
		HostIP: "0.0.0.0",
		HostPort: "0", // random host port
	},
	"5000/tcp": {
		HostIP: "0.0.0.0",
		HostPort: "0", // random host port
	},
}

var requiredVolumes = map[string]string{
	"cvmfs-cache": "/cvmfs-cache",
	"jupyter_data": fmt.Sprintf("/home/%s", JupyterUser),
}

func makePorts(ports map[string]nat.PortBinding) (nat.PortSet, nat.PortMap) {
    exposedPorts := make(nat.PortSet, len(ports))
	portBindings := make(nat.PortMap, len(ports))

	for port, binding := range requiredPorts {
		p := nat.Port(port)
		exposedPorts[p] = struct{}{}
		portBindings[p] = []nat.PortBinding{binding}
	}

    return exposedPorts, portBindings
}

func makeVolumeBindings(volumes map[string]string) []string {
	bindings := []string{}
	for volName, containerPath := range volumes {
		bindings = append(bindings, fmt.Sprintf("%s:%s", volName, containerPath))
	}
	return bindings
}	

func (m *Manager) StartJupyter(ctx context.Context, gpu string, eessi_version string) error {

	useGPU := gpu != "cpu"
	log.Printf("Starting Jupyter container with GPU: %s, EESSI version: %s", gpu, eessi_version)

	reader, err := m.cli.ImagePull(
		ctx,
		JupyterImage,
		image.PullOptions{},
	)
	if err == nil {
		// Ensure the stream is fully consumed so the reader is not terminated prematurely
		io.Copy(os.Stdout, reader)
		defer reader.Close()
	} 

	exposedPorts, portBindings := makePorts(requiredPorts)
	volumeBindings := makeVolumeBindings(requiredVolumes)

	// -------------------------
	// HOST CONFIG
	// -------------------------
	hostConfig := &container.HostConfig{
		PortBindings: portBindings,
		Binds: volumeBindings,
		Privileged: true,  // Required for CVMFS to work properly
	}

	// -------------------------
	// GPU SUPPORT
	// -------------------------
	if useGPU {
		log.Println("GPU requested, enabling GPU support for Jupyter container")
		log.Printf("Using GPU device: %s", gpu)
		hostConfig.DeviceRequests = []container.DeviceRequest{
			{
				Driver:       "nvidia",
				// Incompatible with DeviceIDs
				// Count:        1,
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
			Env: []string{
				fmt.Sprintf("REQUESTED_EESSI_VERSION=%s", eessi_version),
			},
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

func (m *Manager) CleanupJupyter(ctx context.Context) error {
	return m.cli.ContainerRemove(
		ctx,
		JupyterContainerName,
		container.RemoveOptions{
			Force: true,
		},
	)

}

func (m *Manager) CleanupVolumes(ctx context.Context) error {
	for volName := range requiredVolumes {
		err := m.cli.VolumeRemove(ctx, volName, true)
		if err != nil {
			log.Printf("Error removing volume %s: %v", volName, err)
		}
	}

	return nil
}
