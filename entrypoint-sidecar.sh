#!/bin/bash

# Mount EESSI CVMFS repository
mkdir -p /cvmfs/software.eessi.io
cvmfs2 -o config=/etc/cvmfs/config.d/eessi.conf software.eessi.io /cvmfs/software.eessi.io

# UID=1000
# GID=1000
# USER=eessi_jovyan
# mkdir -p /home/${USER}
# # Check if the user already exists
# if id -u ${USER} &>/dev/null; then
#     echo "User ${USER} already exists."
# else
#     groupadd -g ${GID} ${USER}
#     useradd -u ${UID} -g ${GID} -s /bin/bash -d /home/${USER} ${USER}
#     chown -R ${USER}:${USER} /home/${USER}
# fi

# # Switch to the EESSI user
# su - ${USER}
 
# Load EESSI software environment
source /cvmfs/software.eessi.io/versions/2023.06/init/bash 

# Start JupyterLab server from EESSI
module load JupyterLab
jupyter lab \
    --NotebookApp.token='' \
    --NotebookApp.open_browser='False' \
    --NotebookApp.disable_check_xsrf='True' \
    --allow-root \
    --ip 0.0.0.0
