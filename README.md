# LocalSendPro

A tiny **peer-to-peer file room** for the local network. Open a URL, pick
a file, and it streams browser-to-browser to anyone else on the same URL.
Files never touch the server.

No accounts, no storage, no protocol gymnastics. Just rooms.

## Install

```bash
pip install -r requirements.txt
```

Python 3.9+.

## Run

```bash
python -m localsendpro --port 8080
```

Then open <http://localhost:8080/>. You'll be redirected to a freshly-named
room like `/r/sage-amber-417`. Share that URL with anyone on the same network.
When they open it, a WebRTC connection opens between the two browsers and
anything you drop lands in their tab directly.

## How it works

- A **room** is just a URL slug. The server keeps a set of WebSocket
  connections per room — nothing else.
- The server acts only as a **signalling relay**: it forwards WebRTC SDP
  offers/answers and ICE candidates between the peers in a room.
- File bytes travel **peer-to-peer** over `RTCDataChannel`s. The shared note
  syncs the same way.
- Nothing persists. Close the last tab and the room is gone.

## Server surface (that's all)

| Method | Path             | Purpose                                 |
| ------ | ---------------- | --------------------------------------- |
| GET    | `/`              | Redirect to a fresh room                |
| GET    | `/r/{room}`      | Serve the static page                   |
| WS     | `/ws/{room}`     | Signalling relay (offers/answers/ICE)   |
| GET    | `/static/*`      | CSS / JS                                |

## Project layout

```
localsendpro/
  server.py        FastAPI app + WS signalling relay
  cli.py           argparse entrypoint
  web/
    index.html
    style.css
    app.js
```

## Notes / limits

- Both peers must be online **at the same time** for a transfer — there is
  no storage, nothing waits around for a later visitor.
- Anyone with a room URL can join. Treat room names like passwords if you
  care about privacy on a shared LAN.
- Works on a LAN out of the box (STUN is enough when peers share a network).
  Crossing NATs / the public internet would need a TURN server; not wired up.
- DataChannels are DTLS-encrypted end-to-end, so even though signalling runs
  through the server, file bytes are opaque to it (and never go through it).
- Bind address defaults to `0.0.0.0` so other devices on the LAN can reach
  the page. Use `--host 127.0.0.1` for local-only.
