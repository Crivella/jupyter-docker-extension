package workload

import (
	"context"
)

func (m *Manager) HasGPU(ctx context.Context) (bool, error) {
	info, err := m.cli.Info(ctx)
	if err != nil {
		return false, err
	}

	_, ok := info.Runtimes["nvidia"]

	return ok, nil
}

