# AITW-JupyterLab Docker Extension

This is a Docker Extension aimed at facilitating the access of AI-TranspWood codebases made avaiable in EESSI.
Each code base will present a notebook with an example on how to run a specific tool or workflow with a Graphical User Interface (GUI).

## Installation

### From Marketplace

Since Docker Desktop [v4.11.0](https://docs.docker.com/desktop/release-notes/#docker-desktop-4110) the AITW-JupyterLab Extension is available in Marketplace page:

- From Docker Desktop main window click on **Extensions** tab at left side menu
- If you have not installed any extension yet you will automatically jump to the **Manage**>**Browse** page
- If you have already installed some extension just click on **Manage** tab and then on **Browse** button at top right side of the window
- Look for **AITW-JupyterLab** extension (it will have the AITW project logo on the left)
- Click on install

### From command line

If you are using Docker Desktop [v4.10.1](https://docs.docker.com/desktop/release-notes/#docker-desktop-4101) or less  you can install just by executing:

```bash
$ docker extension install aitranspwood/jupyter-docker-extension:1.0.0
Extensions can install binaries, invoke commands, access files on your machine and connect to remote URLs.
Are you sure you want to continue? [y/N] y
Extracting metadata and files for the extension "aitranspwood/jupyter-docker-extension:1.0.0"
Installing service in Desktop VM...
Setting additional compose attributes
Installing Desktop extension UI for tab "AITW-JupyterLab"...
Extension UI tab "AITW-JupyterLab" added.
Starting service in Desktop VM......
Service in Desktop VM started
Extension "AI-TranspWood codebases in EESSI" installed successfully
```

**Note**: Docker Extension CLI is required to execute above command, follow the instructions at [Extension SDK (Beta) -> Prerequisites](https://docs.docker.com/desktop/extensions-sdk/#prerequisites) page for instructions on how to add it.


## NOTES

- Running the code inside a specific notebook may require loading a specific software from EESSI through JupyterLmod before starting.
  Please refer to the [notebook instructions](https://github.com/AI-TranspWood/jupyter-notebooks) (also available inside the extension) for more details.
- The CVMFS cache is configure to use up to 10GB of disk space on your machine, this is not yet configurable so make sure you have enough disk space available.


## Usage

Once the extension is installed a new extension is listed at the pane Extension of Docker Desktop.
By clicking the project icon the extension main window will display the JupyterLab welcome page once it has loaded.


## Persistent storage

Any data added/created inside `/home/eessi-user` directory will be persistent against Docker Desktop restarts or Extension updates.
The data from the CVMFS cache is also persisted to make running software from EESSI smoother across restarts.

## Uninstall

### From Docker Desktop

- Navigate to the same **Extensions** > **Manage** page where you installed the extension.
- Click the three dots menu on the extension card and select **Uninstall**.

### From Command Line

```bash
$ docker extension uninstall aitranspwood/jupyter-docker-extension:1.0.0
Extension "Jupyter Notebook" uninstalled successfully
```

## Sources

List of repositories including the source code used in this extension:

- Docker Extension: https://github.com/AI-TranspWood/jupyter-docker-extension
- EESSI-enabled jupyterlab container with preloaded AITW notebooks: https://github.com/AI-TranspWood/EESSI-jupyterlab-docker
- AITW-notebooks: https://github.com/AI-TranspWood/jupyter-notebooks
