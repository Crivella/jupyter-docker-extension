package main

import (
	"strconv"
	"flag"
	"log"
	"net"
	"net/http"
	"os"

	"jupyter-docker-extension/workload"

	"github.com/labstack/echo"
	"github.com/sirupsen/logrus"
)

type StartRequest struct {
	GPUDevice string `json:"gpuDevice"` // "0", "1", or "cpu"
	EESSIVersion string `json:"eessiVersion"`
}

func main() {
	var socketPath string
	flag.StringVar(&socketPath, "socket", "/run/guest-services/jupyter-docker-extension.sock", "Unix domain socket to listen on")
	flag.Parse()

	os.RemoveAll(socketPath)

	logrus.Infof("Starting listening on %s", socketPath)

	// --- Docker workload manager (GPU detection + container lifecycle)
	manager, err := workload.New()
	if err != nil {
		log.Fatal(err)
	}
	defer manager.Close()

	router := echo.New()
	router.HideBanner = true

	startURL := ""

	ln, err := listen(socketPath)
	if err != nil {
		log.Fatal(err)
	}
	router.Listener = ln


	// Endpoint to check if the Jupyter container is running
	router.GET("/ready-container", func(ctx echo.Context) error {
		ready := manager.JupyterRunning(
			ctx.Request().Context(),
		)
	
		return ctx.String(
			http.StatusOK,
			strconv.FormatBool(ready),
		)
	})

	// Endpoint to check if the Jupyter server is responding
	router.GET("/ready-server", func (ctx echo.Context) error {
		ip, err := manager.JupyterInternalIP(ctx.Request().Context())
		if err != nil {
			log.Println(err)
			return ctx.String(http.StatusOK, "false")
		}
		log.Println("Jupyter internal IP:", ip)
		url := "http://" + ip + ":8888/"
		resp, err := http.Get(url)
		if err != nil {
			log.Println(err)
			return ctx.String(http.StatusOK, "false")
	
		}
		defer resp.Body.Close()

		log.Println("Jupyter server response status:", resp.StatusCode)
	
		return ctx.String(resp.StatusCode, "true")
	
	})

	// Endpoint to check if a GPU is available
	router.GET("/gpu", func(c echo.Context) error {
		gpu, err := manager.HasGPU(c.Request().Context())
	
		if err != nil {
			return c.JSON(500, map[string]any{
				"error": err.Error(),
			})
		}
	
		return c.JSON(200, map[string]any{
			"gpuAvailable": gpu,
		})
	})

	// Endpoint to list available GPUs
	router.GET("/gpu-list", func(c echo.Context) error {
		gpus, err := manager.ListGPUs(c.Request().Context())
		if err != nil {
			return c.JSON(500, err.Error())
		}
		return c.JSON(200, gpus)
	})

	// Endpoint to start the Jupyter container
	router.POST("/start", func(c echo.Context) error {
		var req StartRequest
		if err := c.Bind(&req); err != nil {
			return c.JSON(400, err.Error())
		}

		log.Println("Starting Jupyter with:", req)
	
		err := manager.StartJupyter(
			c.Request().Context(),
			req.GPUDevice,
			req.EESSIVersion,
		)
		if err != nil {
			return c.JSON(500, err.Error())
		}
	
		return c.JSON(200, map[string]any{
			"message": "Jupyter started successfully",
		})
	})

	log.Fatal(router.Start(startURL))
}

func listen(path string) (net.Listener, error) {
	return net.Listen("unix", path)
}
