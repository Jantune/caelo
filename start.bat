@echo off
title Caelo
cd /d "%~dp0desktop"
set CAELO_CORE_PYTHON=D:\Users\91432\Toolchains\Miniconda3\envs\FuelCell\python.exe
echo Starting Caelo...
node_modules\electron\dist\electron.exe .
