#!/bin/bash

USER=eessi-user

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
# rm -fr .jupyter
su -c '
source /cvmfs/software.eessi.io/versions/2023.06/init/bash 
# module load EESSI-extend
# eb jupyterlmod-4.0.3-GCCcore-12.3.0.eb -r 
# module load jupyterlmod/4.0.3-GCCcore-12.3.0
# export JUPYTER_PATH="$EBROOTJUPYTERLMOD/share/jupyter:$JUPYTER_PATH"
module load JupyterLab

pip install --user jupyterlmod
pip install --user octave_kernel
module load Octave/10.1.0
python -m octave_kernel install --user

# # ----------------------------------------------------------------
# module load Python
# export PATH="$HOME/.local/bin:$PATH"
# pip install --user --upgrade pip
# pip install --user jupyter jupyter-server-proxy
# pip install --user jupyter-code-server
# pip install --user pip install jupyter-rsession-proxy
# pip install --user jupyterlmod

# module load EESSI-extend
# eb code-server-4.105.1.eb - r
# export JSP_CODE_SERVER_LMOD_MODULE=code-server/4.105.1
# export CODE_DISABLE_PASSWORD=true

# pip install --user octave_kernel
# module load Octave/10.1.0
# python -m octave_kernel install --user
# # ----------------------------------------------------------------

# source /cvmfs/software.eessi.io/versions/2025.06/init/bash 
# module load EESSI-extend
# eb jupyterlmod-5.2.2-GCCcore-13.3.0.eb -r 
# module load jupyterlmod/5.2.2-GCCcore-13.3.0
# export JUPYTER_PATH="$EBROOTJUPYTERLMOD/share/jupyter:$JUPYTER_PATH"
# module load JupyterLab/4.2.5-GCCcore-13.3.0

export -f module

jupyter lab \
    --NotebookApp.token='' \
    --NotebookApp.open_browser='False' \
    --NotebookApp.disable_check_xsrf='True' \
    --allow-root \
    --ip 0.0.0.0
' ${USER}

tail -f /dev/null
