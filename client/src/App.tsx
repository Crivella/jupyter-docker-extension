import { createDockerDesktopClient } from '@docker/extension-api-client';
import { Grid, LinearProgress, Typography, useMediaQuery } from '@mui/material';
import { useEffect, useState } from 'react';

const client = createDockerDesktopClient();
const vmName = 'AITW-eessi-jupyter-runtime';
const vmUser = 'eessi-user';
const jlabConfigDir = `/home/${vmUser}/.jupyter/lab/user-settings/@jupyterlab/apputils-extension/`;
const jlabConfigFile = `${jlabConfigDir}/themes.jupyterlab-settings`;

function useDockerDesktopClient() {
  return client;
}

export function App() {
  const [gpus, setGpus] = useState<any[]>([]);
  const [selectedGpu, setSelectedGpu] = useState("cpu");
  const [eessiVersions, setEessiVersions] = useState<string[]>(["2023.06", "2025.06"]);
  const [selectedEessiVersion, setSelectedEessiVersion] = useState<string | null>(null);
  
  const [initialCheck, setInitialCheck] = useState(true);
  const [starting, setStarting] = useState(false);
  const [readyContainer, setReadyContainer] = useState(false);
  const [readyServer, setReadyServer] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  
  const [tokenStr, setTokenStr] = useState('');
  const [port, setPort] = useState<number | null>(null);
  const isDarkModeEnabled = useMediaQuery('(prefers-color-scheme: dark)', { noSsr: true });
  const prevMode = isDarkModeEnabled ? 'Light' : 'Dark';
  const currentMode = isDarkModeEnabled ? 'Dark' : 'Light';

  const ddClient = useDockerDesktopClient();

  // Functions ---------------------------------------------------------------------------------------------------------
  const getGPUList = async () => {
    try {
      const result = await ddClient.extension.vm?.service?.get('/gpu-list');
      setGpus(result as any[]);
    } catch (error) {
      console.log('error when getting GPU list', error);
    }
  }

  const checkReadyServer = async () => {
    try {
      const result = await ddClient.extension.vm?.service?.get('/ready-server');
      console.log('checkReadyServer result:', result);
      return Boolean(result);
    } catch (error) {
      console.log('error when checking Jupyter Notebook status', error);
      return false;
    }
  }

  const checkReadyContainer = async () => {
    try {
      const result = await ddClient.extension.vm?.service?.get('/ready-container');
      console.log('checkReadyContainer result:', result);
      return Boolean(result);
    } catch (error) {
      console.log('error when checking Jupyter Notebook container status', error);
      return false;
    }
  }

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
    console.log('Getting Jupyter token');
    ddClient.docker.cli.exec("exec", [
      vmName,
      '/usr/bin/su',
      '-c',
      '"/opt/jupyter-env/bin/jupyter server list"',
      vmUser
    ]).then((tokenResult: any) => {
      const tokenMatch = tokenResult?.stdout?.match(/http.*\/\?.*token=([a-z0-9]+)/);
      if (tokenMatch) {
        setTokenStr(`?token=${tokenMatch[1]}`);
      } else {
        console.log(`Failed to get token from jupyter server list output: ${tokenResult?.stdout}`);
      }
    }).catch((error: any) => {
      console.log('Failed to run jupyter server list to get token:', error);
    });
  }

  const getEESSIVersions = async () => {
    console.log('Getting EESSI versions');
    ddClient.docker.cli.exec("exec", [
      vmName,
      'ls',
      '/cvmfs/software.eessi.io/versions'
    ]).then((versionResult: any) => {
      const versions = versionResult?.stdout?.split('\n').filter((line: string) => line.trim() !== '');
      console.log('EESSI versions:', versions);
      setEessiVersions(versions);
    })
  }

  const startJupyter = async () => {
    setStarting(true);
  
    try {
      console.log(`Starting Jupyter Notebook with GPU: ${selectedGpu} and EESSI version: ${selectedEessiVersion}`);
      await ddClient.extension.vm?.service?.post("/start", {
        gpuDevice: selectedGpu,
        eessiVersion: selectedEessiVersion
      });
    } catch (error) {
      console.log('Failed to start Jupyter Notebook', error);
    }
  };

  // useEffect Hooks ---------------------------------------------------------------------------------------------------
  // Startup sequence: get the GPU list and check if the Jupyter server is already running
  useEffect(() => {
    const load = async () => {
      getGPUList();

      // setInitialCheck(true);
      console.log(`Checking if Jupyter Notebook is already running: initialCheck: ${initialCheck}`);
      setStarting(false);
      setReadyServer(false);
      setReadyContainer(false);
      
      if (await checkReadyContainer()) {
        setReadyContainer(true);
      }
      
      if (await checkReadyServer()) {
        setReadyServer(true);
      } else {
        setInitialCheck(false);
      }
      console.log(`DONE Checking if Jupyter Notebook is already running: initialCheck: ${initialCheck}`);
    };
  
    load();
  }, []);

  // Once the container is ready, get the Jupyter port and Flask port (the container needs the env files to start the services)
  useEffect(() => {
    console.log('Calling useEffect for readyContainer with readyContainer:', readyContainer);
    if (readyContainer) {
      getJupyterPort(8888, `/home/${vmUser}/jupyter_port.env`, true);
      getJupyterPort(5000, `/home/${vmUser}/flask_port.env`, false);
    }
  }, [readyContainer]);

  // Once the server is ready, get the Jupyter token and EESSI versions
  useEffect(() => {
    console.log('Calling useEffect for readyServer with readyServer:', readyServer);
    if (readyServer) {
      getToken();
      getEESSIVersions();
      setDarkMode();
    }
  }, [readyServer]);

  // Allow toggling dark mode in the Jupyter Lab interface by updating the config file in the container
  useEffect(() => {
    console.log('Calling useEffect for dark mode with isDarkModeEnabled:', isDarkModeEnabled, 'readyServer:', readyServer);
    if (readyServer) {
      setDarkMode();
    }
  }, [isDarkModeEnabled, readyServer]);

  // Procedure to start the server and poll for readiness. If the server is not ready after 60 seconds, mark it as unavailable.
  useEffect(() => {
    console.log('Calling useEffect with starting:', starting);
    if (!starting) {
      return;
    }
  
    let timer: any = null;
    const start = async () => {
      setReadyContainer(false);
      setReadyServer(false);
    };

    start().then(() => {
      let retries = 60;
      let internalReadyContainer = false;
      let internalReadyServer = false;
      timer = setInterval(async () => {
        if (retries == 0) {
          console.log('Jupyter Notebook is not ready after 60 seconds, marking as unavailable');
          clearInterval(timer);
          setUnavailable(true);
        }

        console.log('Starting loop: readyContainer:', readyContainer, 'readyServer:', readyServer, 'retries left:', retries);
        if (!internalReadyContainer && await checkReadyContainer()) {
          internalReadyContainer = true;
          setReadyContainer(true);
        }

        if (!internalReadyServer && await checkReadyServer()) {
          internalReadyServer = true;

          setReadyServer(true);
          clearInterval(timer);
        } else {
          console.log('Jupyter Notebook is not ready yet, retries left:', retries);
          retries--;
        }
      }, 1000);
    }).catch(error => {
      console.log('failed to start Jupyter Notebook', error);
      ddClient.desktopUI.toast.error(error);
      setStarting(false);
      setUnavailable(true);
    })

    return () => {
      if (timer !== null) {
        clearInterval(timer);
      }
    };
  }, [starting]);
  
  // Once the server is ready, and we have the port and token, redirect the user to the Jupyter Lab interface in their browser
  useEffect(() => {
    if (readyServer) {
      if (!port) {
        console.log("Server ready but port not found yet, waiting for port...");
        return;
      }
      if (!tokenStr) {
        console.log("Server ready but token not found yet, waiting for token...");
        return;
      }
      console.log(`Jupyter Notebook is ready at http://localhost:${port}/lab${tokenStr}`);
      window.location.href = `http://localhost:${port}/lab${tokenStr}`;
      setStarting(false);
    }
  }, [readyServer, port, tokenStr]);

  return (
    <>
      {initialCheck ? (
        <Grid>
          <Grid item>
            Initializing extension...
          </Grid>
        </Grid>
      ) : unavailable ? (
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
            <Typography>
              Select the EESSI version you would like to use:
            </Typography>
          </Grid>

          <Grid item>
            <select
              value={selectedEessiVersion || ""}
              onChange={(e) => setSelectedEessiVersion(e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
              }}
            >
              {eessiVersions.map((version) => (
                <option
                  key={version}
                  value={version}
                >
                  {version}
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
}
