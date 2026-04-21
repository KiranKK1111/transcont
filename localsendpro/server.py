"""Peer-to-peer room rendezvous server.

The server never sees file bytes. A "room" is just a URL slug; the only
server-side state is a dict of WebSocket connections per room. The server
relays WebRTC signalling (SDP offers/answers, ICE candidates) between peers
who share a room URL. Actual files and the shared note flow peer-to-peer
over RTCDataChannels.

Routes:
  GET  /                 -> redirect to /r/<random-slug>
  GET  /r/{room}         -> static page
  WS   /ws/{room}        -> signalling relay
  GET  /static/*         -> css/js
"""
from __future__ import annotations

import secrets
from pathlib import Path

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles


WORDS = [
    "amber", "blue", "coral", "delta", "ember", "frost", "glow", "harbor",
    "iris", "jade", "koi", "lumen", "moss", "nova", "onyx", "pine",
    "quartz", "river", "sage", "tide", "umbra", "vale", "willow", "yarrow",
]


def random_room() -> str:
    return f"{secrets.choice(WORDS)}-{secrets.choice(WORDS)}-{secrets.randbelow(1000):03d}"


def _safe_room(slug: str) -> str:
    s = "".join(c for c in slug if c.isalnum() or c in "-_").strip()
    if not s or len(s) > 64:
        raise HTTPException(status_code=400, detail="bad room name")
    return s


def create_app() -> FastAPI:
    app = FastAPI(title="LocalSendPro", version="0.3.0")

    rooms: dict[str, dict[str, WebSocket]] = {}

    @app.get("/", include_in_schema=False)
    def index():
        return RedirectResponse(url=f"/r/{random_room()}", status_code=302)

    @app.get("/r/{room}", include_in_schema=False)
    def room_page(room: str):
        _safe_room(room)
        web_dir = Path(__file__).parent / "web"
        html = (web_dir / "index.html").read_text(encoding="utf-8")
        def mtime(name: str) -> str:
            try: return str(int((web_dir / name).stat().st_mtime))
            except OSError: return "0"
        html = (html
            .replace("/static/style.css", f"/static/style.css?v={mtime('style.css')}")
            .replace("/static/app.js",    f"/static/app.js?v={mtime('app.js')}"))
        return HTMLResponse(html)

    @app.websocket("/ws/{room}")
    async def ws_signal(ws: WebSocket, room: str):
        slug = _safe_room(room)
        await ws.accept()

        peer_id = secrets.token_urlsafe(6)
        peers = rooms.setdefault(slug, {})

        await ws.send_json({
            "type": "hello",
            "self": peer_id,
            "peers": list(peers.keys()),
        })
        for other in peers.values():
            try:
                await other.send_json({"type": "peer-joined", "id": peer_id})
            except Exception:
                pass
        peers[peer_id] = ws

        try:
            while True:
                msg = await ws.receive_json()
                target = msg.get("to") if isinstance(msg, dict) else None
                if not isinstance(target, str):
                    continue
                dest = peers.get(target)
                if dest is None:
                    continue
                msg["from"] = peer_id
                try:
                    await dest.send_json(msg)
                except Exception:
                    pass
        except WebSocketDisconnect:
            pass
        finally:
            peers.pop(peer_id, None)
            if not peers:
                rooms.pop(slug, None)
            else:
                for other in peers.values():
                    try:
                        await other.send_json({"type": "peer-left", "id": peer_id})
                    except Exception:
                        pass

    web_dir = Path(__file__).parent / "web"
    if web_dir.is_dir():
        app.mount("/static", StaticFiles(directory=str(web_dir)), name="static")

    return app
