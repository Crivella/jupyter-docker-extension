import { createDockerDesktopClient } from '@docker/extension-api-client';
import { Grid, LinearProgress, Typography, useMediaQuery } from '@mui/material';
import { useEffect, useState } from 'react';

const client = createDockerDesktopClient();
const vmName = 'jupyter-runtime';
const vmUser = 'eessi-user';
const jlabConfigDir = `/home/${vmUser}/.jupyter/lab/user-settings/@jupyterlab/apputils-extension/`;
const jlabConfigFile = `${jlabConfigDir}/themes.jupyterlab-settings`;

function useDockerDesktopClient() {
  return client;
}

export function App() {
  const [gpus, setGpus] = useState<any[]>([]);
  const [selectedGpu, setSelectedGpu] = useState("cpu");
  const [starting, setStarting] = useState(false);
  // const [runtime, setRuntime] = useState<any>(null);

  const [port, setPort] = useState<number | null>(null);
  const [tokenStr, setTokenStr] = useState('');
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const ddClient = useDockerDesktopClient();
  const isDarkModeEnabled = useMediaQuery('(prefers-color-scheme: dark)', { noSsr: true });
  const prevMode = isDarkModeEnabled ? 'Light' : 'Dark';
  const currentMode = isDarkModeEnabled ? 'Dark' : 'Light';

  useEffect(() => {
    const load = async () => {
      // let res = await ddClient.extension.vm?.service?.get("/gpu-list");
      // console.log("/gpu-list response:", res);
      // // setGpus(res);
      // setGpus(res as any[]);
      ddClient.extension.vm?.service?.get("/gpu-list").then((res: any) => {
        console.log("/gpu-list response:", res);
        setGpus(res as any[]);
      })

      // res = await ddClient.extension.vm?.service?.get("/ready");
      // if (res) {
      //   setReady(true);
      // }
      ddClient.extension.vm?.service?.get("/ready").then((res: any) => {
        if (res) {
          setReady(true);
        }
      })
    };
  
    load();
  }, []);

  const getJupyterPort = async (portNumber: number, envFile: string, isMain: boolean) => {
    console.log(`Getting port ${portNumber} for ${isMain ? 'main' : 'secondary'} service`);
    const portResult = await ddClient.docker.cli.exec("port", [
      vmName,
      portNumber.toString()
    ]);

    const portMatch = portResult?.stdout?.match(/:(\d+)/);
    if (portMatch) {
      console.log(`Port ${portNumber} is mapped to`, portMatch[1]);
      if (isMain) {
        console.log('Setting main port to', portMatch[1]);
        setPort(() => parseInt(portMatch[1]));
      }
      
      ddClient.docker.cli.exec("exec", [
        vmName,
        '/bin/bash',
        '-c',
        `"echo \'${portMatch[1]}\' > ${envFile}"`,
      ]);
    } else {
      throw new Error(`Failed to get port ${portNumber}`);
    }
  }

  const setDarkMode = async () => {
    console.log('Setting dark mode to', currentMode);
    let shCmd = `"sed -i s/${prevMode}/${currentMode}/g ${jlabConfigFile}`
      .concat(` || (mkdir -p ${jlabConfigDir} && echo -e \'{\n    \\"theme\\": \\"JupyterLab ${currentMode}\\\n"}\' > ${jlabConfigFile})"`)
    await ddClient.docker.cli.exec("exec", [
      '-d',
      vmName,
      '/bin/sh',
      '-c',
      shCmd
    ]);
  }

  const getToken = async () => {
    const tokenResult = await ddClient.docker.cli.exec("logs", [
      vmName,
      '--tail',
      '60'
    ]);
    const tokenMatch = tokenResult?.stderr?.match(/http.*\/lab\?.*token=([a-z0-9]+)/);
    if (tokenMatch) {
      setTokenStr(`?token=${tokenMatch[1]}`);
    }
  }

  useEffect(() => {
    if (ready) {
      getJupyterPort(8888, `/home/${vmUser}/jupyter_port.env`, true);
      getJupyterPort(5000, `/home/${vmUser}/flask_port.env`, false);
      getToken();
    }
  }, [ready]);

  useEffect(() => {
    console.log('Calling useEffect for dark mode with isDarkModeEnabled:', isDarkModeEnabled, 'ready:', ready);
    if (!ready) {
      return;
    }

    setDarkMode().then(() => {
      console.log('Set dark mode to', currentMode);
    }).catch(error => {
      console.log('Failed to set dark mode', error);
    });
  }, [isDarkModeEnabled, ready]);

  useEffect(() => {
    console.log('Calling useEffect with starting:', starting, 'isDarkModeEnabled:', isDarkModeEnabled);
    let timer: number;
    const start = async () => {
      setReady(() => false);
      // sleep 2 seconds to ensure the VM has been started
      await new Promise(resolve => setTimeout(resolve, 4000));

      // setDarkMode();
      // getJupyterPort(8888, `/home/${vmUser}/jupyter_port.env`, true);
      // getJupyterPort(5000, `/home/${vmUser}/flask_port.env`, false);
      getJupyterPort(8888, `/home/${vmUser}/jupyter_port.env`, true);
      getJupyterPort(5000, `/home/${vmUser}/flask_port.env`, false);
    };

    if (!starting) {
      return;
    }
    start().then(() => {
      let retries = 60;
      let timer = setInterval(async () => {

        if (retries == 0) {
          clearInterval(timer);
          setUnavailable(true);
        }

        try {
          const result = await ddClient.extension.vm?.service?.get('/ready');

          if (Boolean(result)) {

            // Get the token from the VM service
            const tokenResult = await ddClient.docker.cli.exec("logs", [
              vmName,
              // '--tail',
              // '60'
            ]);
            // Invert order of lines to find the latest token first (server restartswill cause a new token
            // to be generated and old token to be invalid)
            const reversed = tokenResult?.stderr?.split('\n').reverse()?.join('\n');
            const tokenMatch = reversed?.match(/http.*\/lab\?.*token=([a-z0-9]+)/);
            if (tokenMatch) {
              setTokenStr(`?token=${tokenMatch[1]}`);
            }

            // Set ready to true to show the iframe
            setReady(() => true);
            setStarting(() => false);
            clearInterval(timer);
          }
        } catch (error) {
          console.log('error when checking Jupyter Notebook status', error);
          retries--;
        }
      }, 1000);
    }).catch(error => {
      console.log('failed to start Jupyter Notebook', error);
      ddClient.desktopUI.toast.error(error);
      setUnavailable(true);
    })

    return () => {
      clearInterval(timer);
    };
  }, [starting]);
  
  const startJupyter = async () => {
    setStarting(true);
  
    const res = await ddClient.extension.vm?.service?.post("/start", {
      gpuDevice: selectedGpu,
    });
  
    // setRuntime(res);
  };

  useEffect(() => {
    if (ready && port) {
      console.log(`Jupyter Notebook is ready at http://localhost:${port}/lab${tokenStr}`);
      window.location.href = `http://localhost:${port}/lab${tokenStr}`;
    }
  }, [ready, port, tokenStr]);

  return (
    <>
      {unavailable ? (
        <Grid
          container
          flex={1}
          direction="column"
          padding="16px 32px"
          height="100%"
          justifyContent="center"
          alignItems="center"
        >
          <Grid item>
            Jupyter Notebook failed to start. Please close the extension and
            reopen/reinstall to try again.
          </Grid>
        </Grid>
      ) : ready ? (
        (() => {
          // window.location.href = `http://localhost:${port}/lab${tokenStr}`;
          return null;
        })()
      ) : starting ? (
        <Grid
          container
          flex={1}
          direction="column"
          padding="16px 32px"
          height="100%"
          justifyContent="center"
          alignItems="center"
        >
          <Grid item sx={{ width: "100%" }}>
            <LinearProgress />
            <Typography mt={2}>
              Starting Jupyter environment...
            </Typography>
          </Grid>
        </Grid>
      ) : (
        <Grid
          container
          flex={1}
          direction="column"
          padding="16px 32px"
          spacing={2}
        >
          <Grid item>
            <Typography variant="h5">
              Start Jupyter Environment
            </Typography>
          </Grid>
  
          <Grid item>
            <Typography>
              Select the compute resource you would like to use:
            </Typography>
          </Grid>
  
          <Grid item>
            <select
              value={selectedGpu}
              onChange={(e) => setSelectedGpu(e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
              }}
            >
              <option value="cpu">CPU only</option>
  
              {gpus.map((gpu) => (
                <option
                  key={gpu.id}
                  value={gpu.id}
                >
                  {gpu.name}
                </option>
              ))}
            </select>
          </Grid>
  
          <Grid item>
            <button
              onClick={startJupyter}
              style={{
                padding: "8px 16px",
                cursor: "pointer",
              }}
            >
              Start Jupyter
            </button>
          </Grid>
        </Grid>
      )}
    </>
  );
  // return (
  //   <>
  //     {unavailable && (
  //       <Grid container flex={1} direction="column" padding="16px 32px" height="100%" justifyContent="center" alignItems="center">
  //         <Grid item>
  //         Jupyter Notebook failed to start, please close the extension and reopen/reinstall to try again.
  //         </Grid>
  //       </Grid>
  //     )}
  //     {!ready && (
  //       <Grid container flex={1} direction="column" padding="16px 32px" height="100%" justifyContent="center" alignItems="center">
  //         <Grid item>
  //           <LinearProgress/>
  //           <Typography mt={2}>
  //             Waiting for Jupyter Notebook to be ready. It may take some seconds if
  //             it's the first time.
  //           </Typography>
  //         </Grid>
  //       </Grid>
  //     )}
  //     {ready && (
  //       window.location.href = `http://localhost:${port}/lab${tokenStr}`
  //     )}
  //   </>
  // );
}
