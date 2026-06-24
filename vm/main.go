package main

import (
	// "context"
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

	// ctx := context.Background()

	// // --- Ensure Jupyter is running (GPU or CPU decision happens here)
	// if err := manager.EnsureJupyter(ctx); err != nil {
	// 	log.Fatalf("failed to start jupyter: %v", err)
	// }

	router := echo.New()
	router.HideBanner = true

	startURL := ""

	ln, err := listen(socketPath)
	if err != nil {
		log.Fatal(err)
	}
	router.Listener = ln

	router.GET("/ready2", func(ctx echo.Context) error {
		ready := manager.JupyterRunning(
			ctx.Request().Context(),
		)
	
		return ctx.String(
			http.StatusOK,
			strconv.FormatBool(ready),
		)
	})
	router.GET("/ready", func (ctx echo.Context) error {
		ip, err := manager.JupyterInternalIP(ctx.Request().Context())
		if err != nil {
			log.Println(err)
			return ctx.String(http.StatusOK, "false")
		}
		log.Println("Jupyter internal IP:", ip)
		url := "http://" + ip + ":8888/"
		// url := "http://jupyter:8888/" // "jupyter" is the name of the service defined in docker-compose.yml
		resp, err := http.Get(url)
		if err != nil {
			log.Println(err)
			return ctx.String(http.StatusOK, "false")
	
		}
		defer resp.Body.Close()
	
		return ctx.String(resp.StatusCode, "true")
	
		// return ctx.JSON(http.StatusOK, HTTPMessageBody{Message: "hello from HTTP"})
	
	})
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
	router.GET("/gpu-list", func(c echo.Context) error {
		gpus, err := manager.ListGPUs(c.Request().Context())
		if err != nil {
			return c.JSON(500, err.Error())
		}
		return c.JSON(200, gpus)
	})
	router.POST("/start", func(c echo.Context) error {
		var req StartRequest
		if err := c.Bind(&req); err != nil {
			return c.JSON(400, err.Error())
		}
	
		err := manager.StartJupyter(
			c.Request().Context(),
			req.GPUDevice,
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

// // ready checks whether Jupyter Notebook is ready or not by querying jupyter:8080.
// func ready(ctx echo.Context) error {
// 	url := "http://jupyter:8888/" // "jupyter" is the name of the service defined in docker-compose.yml
// 	resp, err := http.Get(url)
// 	if err != nil {
// 		log.Println(err)
// 		return ctx.String(http.StatusOK, "false")

// 	}
// 	defer resp.Body.Close()

// 	return ctx.String(resp.StatusCode, "true")

// 	// return ctx.JSON(http.StatusOK, HTTPMessageBody{Message: "hello from HTTP"})

// }

func listen(path string) (net.Listener, error) {
	return net.Listen("unix", path)
}

type HTTPMessageBody struct {
	Message string `json:"message"`
	Body    string `json:"body,omitempty"`
}
