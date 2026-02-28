@echo off
REM Pheromone Orchestrator - Manual Runner
REM Run this to test the orchestrator

echo === Pheromone Orchestrator ===
echo Time: %date% %time%
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0orchestrator.ps1"

echo.
echo Orchestrator check completed!
pause