@echo off
title RainSim Server
echo =======================================
echo   Updating RainSim from GitHub...
echo =======================================
echo.

REM Uppdatera repot
git pull

echo.
echo =======================================
echo   Installing requirements...
echo =======================================
echo.

REM Installera beroenden
pip install -r requirements.txt

echo.
echo =======================================
echo   Starting FastAPI server...
echo =======================================
echo.

REM Starta servern
start http://127.0.0.1:8000
uvicorn main:app --reload --port 8000

pause
