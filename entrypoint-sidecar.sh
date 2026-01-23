#!/bin/bash

USER=jovyan

# Needed to avoid `Failed to initialize loader socket` error
# Needs to be inside the entrypoint script in case of volume mounts
mkdir -p /cvmfs-cache
chown -R cvmfs:cvmfs /cvmfs-cache

# Ensure Jupyter config directory exists and is owned by the specified user
mkdir -p /home/${USER}/.jupyter
chown -R ${USER}:${USER} /home/${USER}/.jupyter

# Mount EESSI CVMFS repository
mkdir -p /cvmfs/software.eessi.io
mount -t cvmfs software.eessi.io /cvmfs/software.eessi.io

# Run JupyterLab from EESSI as specified user
cd /home/${USER}
su -c '
source /cvmfs/software.eessi.io/versions/2023.06/init/bash 
module load EESSI-extend
eb jupyterlmod-4.0.3-GCCcore-12.3.0.eb -r
module load JupyterLab
module load jupyterlmod/4.0.3-GCCcore-12.3.0
export JUPYTER_PATH="$EBROOTJUPYTERLMOD/share/jupyter:$JUPYTER_PATH"

jupyter lab \
    --NotebookApp.token='' \
    --NotebookApp.open_browser='False' \
    --NotebookApp.disable_check_xsrf='True' \
    --ip 0.0.0.0
' ${USER}
