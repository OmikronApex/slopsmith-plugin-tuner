"""Tuner plugin — persist last selected tuning in config_dir."""

import json
from pathlib import Path
from typing import List, Dict, Optional
from fastapi import FastAPI, Request

DEFAULT_TUNING = "Guitar Standard"

def setup(app: FastAPI, context: dict):
    config_dir = Path(context["config_dir"])
    config_file = config_dir / "tuner.json"

    def _read() -> dict:
        defaults = {
            "lastTuning": DEFAULT_TUNING,
            "customTunings": {},
            "disabledTunings": []
        }
        if not config_file.exists():
            return defaults
        try:
            data = json.loads(config_file.read_text(encoding="utf-8"))
            if not isinstance(data, dict):
                return defaults
            
            res = {}
            res["lastTuning"] = str(data.get("lastTuning", DEFAULT_TUNING))
            res["customTunings"] = data.get("customTunings", {})
            res["disabledTunings"] = data.get("disabledTunings", [])
            
            if not isinstance(res["customTunings"], dict):
                res["customTunings"] = {}
            if not isinstance(res["disabledTunings"], list):
                res["disabledTunings"] = []
                
            return res
        except Exception:
            return defaults

    def _write(data: dict) -> None:
        config_dir.mkdir(parents=True, exist_ok=True)
        # Merge with existing to be safe, or just overwrite if we have full object
        current = _read()
        current.update(data)
        config_file.write_text(json.dumps(current, indent=2), encoding="utf-8")

    @app.get("/api/plugins/tuner/config")
    def get_config():
        return _read()

    @app.post("/api/plugins/tuner/config")
    async def set_config(req: Request):
        body = await req.json()
        # Allows partial updates
        _write(body)
        return {"ok": True}
