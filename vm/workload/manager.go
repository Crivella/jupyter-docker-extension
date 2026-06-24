package workload

import (
	"github.com/docker/docker/client"
)

type Manager struct {
	cli *client.Client
}

func New() (*Manager, error) {
	cli, err := client.NewClientWithOpts(
		client.FromEnv,
		client.WithAPIVersionNegotiation(),
	)

	if err != nil {
		return nil, err
	}

	return &Manager{cli: cli}, nil
}

func (m *Manager) Client() *client.Client {
	return m.cli
}

func (m *Manager) Close() error {
	return m.cli.Close()
}