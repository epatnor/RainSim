# main.py
# FastAPI-server för scenparametrar + statiska filer

# Kommentar: standard FastAPI + CORS + statiska filer (./public) så index.html kan servas direkt.
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, confloat
from typing import Optional, Dict

app = FastAPI(title="Scene Control API")

# Kommentar: tillåt lokal utveckling från valfri origin (enkelt i dev).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Kommentar: pydantic-modell med rimliga intervall.
class SceneParams(BaseModel):
    timeOfDay: confloat(ge=0.0, le=24.0) = 16.0
    rain:      confloat(ge=0.0, le=1.0)  = 0.4
    wetness:   confloat(ge=0.0, le=1.0)  = 0.5
    fog:       confloat(ge=0.0, le=1.0)  = 0.35
    cloudiness:confloat(ge=0.0, le=1.0)  = 0.4
    wind:      confloat(ge=0.0, le=1.0)  = 0.3
    exposure:  confloat(ge=0.3, le=2.0)  = 1.0

# Kommentar: enkel in-memory store (byt mot DB senare).
STATE: Dict[str, float] = SceneParams().model_dump()

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/api/scene", response_model=SceneParams)
def get_scene():
    return STATE

@app.post("/api/scene", response_model=SceneParams)
def set_scene(payload: SceneParams):
    STATE.update(payload.model_dump())
    return STATE

@app.patch("/api/scene", response_model=SceneParams)
def patch_scene(payload: dict):
    if not payload:
        raise HTTPException(status_code=400, detail="Empty PATCH")
    # Kommentar: validera via Pydantic genom att skapa en kopia.
    new_state = {**STATE, **payload}
    try:
        valid = SceneParams(**new_state)
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))
    STATE.update(valid.model_dump())
    return STATE

# Kommentar: serva ./public som webbrot (lägg index.html där).
app.mount("/", StaticFiles(directory="public", html=True), name="public")
