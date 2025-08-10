@echo off
title RainSim Server
echo =======================================
echo   Starting RainSim FastAPI server...
echo =======================================
echo.

REM Installera beroenden från requirements.txt
pip install -r requirements.txt

REM Starta servern (reload för dev-läge)
uvicorn main:app --reload --port 8000

pause
