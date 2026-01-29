#!/bin/bash

USER=eessi-user

# Needed to avoid `Failed to initialize loader socket` error
# Needs to be inside the entrypoint script in case of volume mounts
mkdir -p /cvmfs-cache
chown -R cvmfs:cvmfs /cvmfs-cache

# Ensure Jupyter config directory exists and is owned by the specified user
rm -fr /home/${USER}/.jupyter
mkdir -p /home/${USER}/.jupyter/lab/workspaces

BASHRC="/home/${USER}/.bashrc"
if [ -z "`grep 'module reload' ${BASHRC}`" ]; then
    echo 'test ! -z "$EESSI_EPREFIX" && source $EESSI_EPREFIX/usr/share/Lmod/init/bash' >> ${BASHRC}
    echo 'module reload' >> ${BASHRC}
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> ${BASHRC}
fi

chown -R ${USER}:${USER} /home/${USER}
# chown -R ${USER}:${USER} /home/${USER}/.jupyter/lab/workspaces

# Mount EESSI CVMFS repository
mkdir -p /cvmfs/software.eessi.io
mount -t cvmfs software.eessi.io /cvmfs/software.eessi.io


# Run JupyterLab from EESSI as specified user
cd /home/${USER}
su -c '
source /cvmfs/software.eessi.io/versions/2023.06/init/bash

export OMP_NUM_THREADS=1                                      
export OMPI_MCA_osc=^ucx                                      
export OMPI_MCA_btl=^openib,ofi                               
export OMPI_MCA_pml=^ucx                                      
export OMPI_MCA_mtl=^ofi                                      
export OMPI_MCA_btl_tcp_if_exclude=docker0,127.0.0.0/8 

module load EESSI-extend

eb jupyterlmod-4.0.3-GCCcore-12.3.0.eb -r 

module load JupyterLab
module load jupyterlmod/4.0.3-GCCcore-12.3.0
CHECK="`jupyter labextension list 2>&1 | grep lmod`"
module purge
module load EESSI-extend

if [ -z "$CHECK" ]; then
    # echo "REBUILDING!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
    eb jupyter-server-2.7.2-GCCcore-12.3.0.eb --rebuild
else
    # echo "NOT REBUILDING-------------------------------------------------------"
fi

eb --from-pr 25155 -r

# module load jupyterlmod/4.0.3-GCCcore-12.3.0
# export JUPYTER_PATH="$EBROOTJUPYTERLMOD/share/jupyter:$JUPYTER_PATH"
# module load Jupyter-bundle/20230823-GCCcore-12.3.0

# pip install --user jupyterlmod
# # echo "Installing octave-kernel"
# pip install --user octave_kernel
# module load Octave/10.1.0
# export JUPYTER_PATH="/home/eessi-user/.local/lib/python3.11/site-packages/octave_kernel:$JUPYTER_PATH"
# python -m octave_kernel install --user

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

# export -f module

module load JupyterLab
module load jupyterlmod/4.0.3-GCCcore-12.3.0

jupyter lab \
    --NotebookApp.token="" \
    --NotebookApp.open_browser="False" \
    --NotebookApp.disable_check_xsrf="True" \
    --ip 0.0.0.0
' ${USER}

tail -f /dev/null
