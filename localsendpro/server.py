"""Shared-room file server (envpad-style).

A "room" is just a URL slug. Anyone who knows /r/<slug> can list, upload,
download, and delete files in it, and read/write a shared text note.
Files live on disk under <data_dir>/<slug>/.

Five JSON endpoints — that's the whole API:

  GET    /api/{room}              -> { files: [...], note: "..." }
  POST   /api/{room}/upload       -> multipart files=...
  GET    /api/{room}/dl/{name}    -> download a file
  DELETE /api/{room}/dl/{name}    -> delete a file
  PUT    /api/{room}/note         -> { text: "..." }
"""
from __future__ import annotations

import os
import secrets
import time
from pathlib import Path
from typing import List

from fastapi import FastAPI, HTTPException, UploadFile, File, Request
from fastapi.responses import FileResponse, RedirectResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles


WORDS = [
    "amber", "blue", "coral", "delta", "ember", "frost", "glow", "harbor",
    "iris", "jade", "koi", "lumen", "moss", "nova", "onyx", "pine",
    "quartz", "river", "sage", "tide", "umbra", "vale", "willow", "yarrow",
]


def random_room() -> str:
    return f"{secrets.choice(WORDS)}-{secrets.choice(WORDS)}-{secrets.randbelow(1000):03d}"


def _safe_name(name: str) -> str:
    name = os.path.basename(name or "")
    bad = '<>:"/\\|?*\x00'
    name = "".join("_" if c in bad else c for c in name)
    return name or "file"


def _safe_room(slug: str) -> str:
    s = "".join(c for c in slug if c.isalnum() or c in "-_").strip()
    if not s or len(s) > 64:
        raise HTTPException(status_code=400, detail="bad room name")
    return s


def create_app(data_dir: Path) -> FastAPI:
    data_dir = Path(data_dir).expanduser().resolve()
    data_dir.mkdir(parents=True, exist_ok=True)

    app = FastAPI(title="LocalSendPro", version="0.2.0")

    def room_dir(slug: str) -> Path:
        d = data_dir / _safe_room(slug)
        d.mkdir(parents=True, exist_ok=True)
        return d

    # ---- pages ----
    @app.get("/", include_in_schema=False)
    def index():
        return RedirectResponse(url=f"/r/{random_room()}", status_code=302)

    @app.get("/r/{room}", include_in_schema=False)
    def room_page(room: str):
        _safe_room(room)
        html = (Path(__file__).parent / "web" / "index.html").read_text(encoding="utf-8")
        return HTMLResponse(html)

    # ---- API (5 endpoints) ----
    @app.get("/api/{room}")
    def api_list(room: str):
        d = room_dir(room)
        files = []
        for p in sorted(d.iterdir()):
            if p.is_file() and p.name != "_note.txt":
                st = p.stat()
                files.append({"name": p.name, "size": st.st_size, "at": st.st_mtime})
        note_path = d / "_note.txt"
        note = note_path.read_text(encoding="utf-8") if note_path.exists() else ""
        return {"room": _safe_room(room), "files": files, "note": note}

    @app.post("/api/{room}/upload")
    async def api_upload(room: str, files: List[UploadFile] = File(...)):
        d = room_dir(room)
        saved = 0
        for uf in files:
            name = _safe_name(uf.filename)
            out = d / name
            # Avoid clobbering: append " (n)" before suffix
            if out.exists():
                stem, suf = out.stem, out.suffix
                i = 1
                while (d / f"{stem} ({i}){suf}").exists():
                    i += 1
                out = d / f"{stem} ({i}){suf}"
            with open(out, "wb") as fh:
                while True:
                    chunk = await uf.read(1024 * 1024)
                    if not chunk:
                        break
                    fh.write(chunk)
            saved += 1
        return {"ok": True, "saved": saved}

    @app.get("/api/{room}/dl/{name}")
    def api_download(room: str, name: str):
        d = room_dir(room)
        path = d / _safe_name(name)
        if not path.is_file():
            raise HTTPException(status_code=404, detail="not found")
        return FileResponse(path, filename=path.name)

    @app.delete("/api/{room}/dl/{name}")
    def api_delete(room: str, name: str):
        d = room_dir(room)
        path = d / _safe_name(name)
        if path.is_file():
            path.unlink()
        return {"ok": True}

    @app.put("/api/{room}/note")
    async def api_note(room: str, req: Request):
        body = await req.json()
        text = (body or {}).get("text", "")
        if not isinstance(text, str):
            raise HTTPException(status_code=400, detail="text must be string")
        if len(text) > 200_000:
            raise HTTPException(status_code=413, detail="note too long")
        (room_dir(room) / "_note.txt").write_text(text, encoding="utf-8")
        return {"ok": True}

    # static assets (css/js) under /static
    web_dir = Path(__file__).parent / "web"
    if web_dir.is_dir():
        app.mount("/static", StaticFiles(directory=str(web_dir)), name="static")

    return app
