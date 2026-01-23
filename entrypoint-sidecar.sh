#!/bin/bash

# Needed to avoid `Failed to initialize loader socket` error
# Needs to be inside the entrypoint script in case of volume mounts
mkdir -p /cvmfs-cache
chown -R cvmfs:cvmfs /cvmfs-cache
cat /etc/cvmfs/config.d/software.eessi.io.conf
ls -la /cvmfs-cache

ls -l /home
ls -la /home/jovyan

# Mount EESSI CVMFS repository
mkdir -p /cvmfs/software.eessi.io
# cvmfs2 -o config=/etc/cvmfs/config.d/software.eessi.io.conf software.eessi.io /cvmfs/software.eessi.io
mount -t cvmfs software.eessi.io /cvmfs/software.eessi.io

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

cd /home/jovyan
su -c '
whoami
pwd
echo "-------------------------------------------------------------------------------"
source /cvmfs/software.eessi.io/versions/2023.06/init/bash 
module load JupyterLab
jupyter lab \
    --NotebookApp.token='' \
    --NotebookApp.open_browser='False' \
    --NotebookApp.disable_check_xsrf='True' \
    --allow-root \
    --ip 0.0.0.0
' jovyan
 
# Load EESSI software environment
# source /cvmfs/software.eessi.io/versions/2023.06/init/bash 
# module load JupyterLab
# jupyter lab \
#     --NotebookApp.token='' \
#     --NotebookApp.open_browser='False' \
#     --NotebookApp.disable_check_xsrf='True' \
#     --allow-root \
#     --ip 0.0.0.0

# Start JupyterLab server from EESSI

# $@
