"""EnvPad-style persistent notes server.

Each URL slug is a workspace. A workspace holds one or more named docs,
each with its own content and language. Anyone with the URL can read and
write. Docs are persisted in SQLite with a 50 MB per-doc cap.

Routes:
  GET    /                                          -> landing page
  GET    /{workspace}                               -> editor page
  GET    /api/ws/{workspace}/docs                   -> list docs
  POST   /api/ws/{workspace}/docs                   -> create doc {name, language?}
  GET    /api/ws/{workspace}/docs/{name}            -> read doc
  PUT    /api/ws/{workspace}/docs/{name}            -> upsert {content, language}
  POST   /api/ws/{workspace}/docs/{name}/rename     -> {to}
  DELETE /api/ws/{workspace}/docs/{name}            -> delete doc
  DELETE /api/ws/{workspace}/folders/{folder}       -> delete folder + all its docs
  GET    /static/*                                  -> assets
"""
from __future__ import annotations

import os
import re
import sqlite3
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel


MAX_DOC_BYTES = 300 * 1024 * 1024  # 300 MB per doc

_SLUG_RE = re.compile(r"^[A-Za-z0-9_\-]{1,64}$")
_RESERVED_SLUGS = {"api", "static", "favicon.ico", "robots.txt"}


def _check_slug(s: str) -> str:
    if s in _RESERVED_SLUGS or not _SLUG_RE.match(s):
        raise HTTPException(status_code=400, detail="bad slug")
    return s


def _check_docname(s: str) -> str:
    if not s or len(s) > 128 or s in (".", "..") or any(c in s for c in "/\\"):
        raise HTTPException(status_code=400, detail="bad doc name")
    return s


def _db_path() -> Path:
    env = os.environ.get("ENVPAD_DB")
    return Path(env) if env else Path.cwd() / "envpad.db"


def _open_db() -> sqlite3.Connection:
    db = sqlite3.connect(str(_db_path()), check_same_thread=False, isolation_level=None)
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA synchronous=NORMAL")
    db.executescript("""
        CREATE TABLE IF NOT EXISTS docs (
            workspace  TEXT NOT NULL,
            name       TEXT NOT NULL,
            content    TEXT NOT NULL DEFAULT '',
            language   TEXT NOT NULL DEFAULT 'plaintext',
            updated_at REAL NOT NULL,
            PRIMARY KEY (workspace, name)
        );
    """)
    cols = {r[1] for r in db.execute("PRAGMA table_info(docs)").fetchall()}
    if "folder" not in cols:
        db.execute("ALTER TABLE docs ADD COLUMN folder TEXT NOT NULL DEFAULT ''")
        db.execute("UPDATE docs SET folder = workspace WHERE folder = ''")
    return db


def _check_foldername(s: str) -> str:
    if not s or len(s) > 128 or s in (".", "..") or any(c in s for c in "/\\"):
        raise HTTPException(status_code=400, detail="bad folder name")
    return s


class CreateBody(BaseModel):
    name: str
    folder: str = ""
    language: str = "plaintext"


class RenameBody(BaseModel):
    to: str


@asynccontextmanager
async def _lifespan(_app: FastAPI):
    # Silence the benign ConnectionResetError [WinError 10054] that Python's
    # asyncio ProactorEventLoop logs when a browser abruptly closes a keepalive
    # socket (fetch abort, tab close, etc.). The request itself is already
    # resolved by the time this fires — it's just log noise on Windows.
    if sys.platform == "win32":
        import asyncio as _asyncio
        loop = _asyncio.get_running_loop()
        def _handler(lp, ctx):
            if not isinstance(ctx.get("exception"), ConnectionResetError):
                lp.default_exception_handler(ctx)
        loop.set_exception_handler(_handler)
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="EnvPad", version="0.4.0",
                  docs_url=None, redoc_url=None, openapi_url=None,
                  lifespan=_lifespan)
    db = _open_db()
    web_dir = Path(__file__).parent / "web"

    def _serve(name: str) -> HTMLResponse:
        html = (web_dir / name).read_text(encoding="utf-8")
        def mtime(f: str) -> str:
            try: return str(int((web_dir / f).stat().st_mtime))
            except OSError: return "0"
        for asset in ("style.css", "app.js", "landing.js"):
            html = html.replace(f"/static/{asset}", f"/static/{asset}?v={mtime(asset)}")
        return HTMLResponse(html)

    @app.get("/", include_in_schema=False)
    def landing():
        return _serve("index.html")

    @app.get("/favicon.ico", include_in_schema=False)
    def favicon():
        return FileResponse(
            path=str(web_dir / "favicon.svg"),
            media_type="image/svg+xml",
        )

    @app.get("/api/ws/{slug}/docs")
    def list_docs(slug: str):
        _check_slug(slug)
        rows = db.execute(
            "SELECT folder, name, language, length(content) AS size, updated_at"
            " FROM docs WHERE workspace = ? ORDER BY folder, updated_at DESC",
            (slug,),
        ).fetchall()
        if not rows:
            now = time.time()
            db.execute(
                "INSERT INTO docs (workspace, folder, name, updated_at)"
                " VALUES (?, ?, ?, ?)",
                (slug, slug, slug, now),
            )
            rows = [(slug, slug, "plaintext", 0, now)]
        return [
            {"folder": r[0], "name": r[1], "language": r[2],
             "size": r[3], "updated_at": r[4]}
            for r in rows
        ]

    @app.post("/api/ws/{slug}/docs")
    def create_doc(slug: str, body: CreateBody):
        _check_slug(slug)
        name = _check_docname(body.name)
        folder = _check_foldername(body.folder or slug)
        language = body.language or "plaintext"
        now = time.time()
        try:
            db.execute(
                "INSERT INTO docs (workspace, folder, name, language, updated_at)"
                " VALUES (?, ?, ?, ?, ?)",
                (slug, folder, name, language, now),
            )
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=409, detail="doc already exists") from None
        return {"folder": folder, "name": name, "language": language,
                "size": 0, "updated_at": now}

    @app.get("/api/ws/{slug}/docs/{name}")
    def get_doc(slug: str, name: str):
        _check_slug(slug)
        _check_docname(name)
        row = db.execute(
            "SELECT folder, content, language, updated_at FROM docs"
            " WHERE workspace = ? AND name = ?",
            (slug, name),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="not found")
        return Response(
            content=row[1],
            media_type="text/plain; charset=utf-8",
            headers={
                "X-Folder": row[0],
                "X-Language": row[2],
                "X-Updated-At": str(row[3]),
            },
        )

    @app.put("/api/ws/{slug}/docs/{name}")
    async def put_doc(
        slug: str, name: str, request: Request,
        language: str = "plaintext",
    ):
        _check_slug(slug)
        _check_docname(name)
        if len(language) > 32:
            language = "plaintext"
        raw = await request.body()
        if len(raw) > MAX_DOC_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"content too large ({len(raw):,} bytes, cap is {MAX_DOC_BYTES:,})",
            )
        try:
            content = raw.decode("utf-8")
        except UnicodeDecodeError:
            raise HTTPException(status_code=400, detail="non-UTF-8 body") from None
        now = time.time()
        db.execute(
            "INSERT INTO docs (workspace, folder, name, content, language, updated_at)"
            " VALUES (?, ?, ?, ?, ?, ?)"
            " ON CONFLICT(workspace, name) DO UPDATE SET"
            "   content=excluded.content,"
            "   language=excluded.language,"
            "   updated_at=excluded.updated_at",
            (slug, slug, name, content, language, now),
        )
        return {"name": name, "language": language, "size": len(content), "updated_at": now}

    @app.post("/api/ws/{slug}/docs/{name}/rename")
    def rename_doc(slug: str, name: str, body: RenameBody):
        _check_slug(slug)
        _check_docname(name)
        new_name = _check_docname(body.to)
        if new_name == name:
            return {"name": name}
        exists = db.execute(
            "SELECT 1 FROM docs WHERE workspace = ? AND name = ?",
            (slug, new_name),
        ).fetchone()
        if exists:
            raise HTTPException(status_code=409, detail="target name exists")
        cur = db.execute(
            "UPDATE docs SET name = ?, updated_at = ? WHERE workspace = ? AND name = ?",
            (new_name, time.time(), slug, name),
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="not found")
        return {"name": new_name}

    @app.delete("/api/ws/{slug}/docs/{name}")
    def delete_doc(slug: str, name: str):
        _check_slug(slug)
        _check_docname(name)
        cur = db.execute(
            "DELETE FROM docs WHERE workspace = ? AND name = ?", (slug, name)
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="not found")
        return {"ok": True}

    @app.delete("/api/ws/{slug}/folders/{folder}")
    def delete_folder(slug: str, folder: str):
        _check_slug(slug)
        _check_foldername(folder)
        cur = db.execute(
            "DELETE FROM docs WHERE workspace = ? AND folder = ?",
            (slug, folder),
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="folder not found")
        return {"ok": True, "deleted": cur.rowcount}

    if web_dir.is_dir():
        app.mount("/static", StaticFiles(directory=str(web_dir)), name="static")

    @app.get("/{slug}", include_in_schema=False)
    def workspace_page(slug: str):
        _check_slug(slug)
        return _serve("workspace.html")

    return app
