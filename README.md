# LocalSendPro

A tiny self-hosted **shared file room** server, in the spirit of
[envpad.com](https://envpad.com): visit a URL, drop in files and notes, share
the link with anyone on your network, and they see the exact same room.

No accounts, no discovery, no protocol gymnastics. Just rooms.

## Install

```bash
pip install -r requirements.txt
```

Python 3.9+.

## Run

```bash
python -m localsendpro --port 8080 --dir ./data
```

Then open <http://localhost:8080/>. You'll be redirected to a freshly-named
room like `/r/sage-amber-417`. Share that URL with anyone on the same network
and you're both looking at the same files and the same shared note.

## How it works

- A **room** is just a URL slug. Files live on disk under `data/<slug>/`.
- The single static page (`index.html`) is rendered for any `/r/<slug>` URL.
- The browser polls the API every ~2.5s to keep files and the note in sync.
- The shared note auto-saves 500ms after you stop typing.

## API (5 endpoints, that's all)

| Method | Path                       | Purpose                       |
| ------ | -------------------------- | ----------------------------- |
| GET    | `/api/{room}`              | List files + read note        |
| POST   | `/api/{room}/upload`       | Multipart upload (`files=`)   |
| GET    | `/api/{room}/dl/{name}`    | Download a file               |
| DELETE | `/api/{room}/dl/{name}`    | Delete a file                 |
| PUT    | `/api/{room}/note`         | Save the shared note          |

## Project layout

```
localsendpro/
  server.py        FastAPI app + 5 endpoints
  cli.py           argparse entrypoint
  web/
    index.html
    style.css
    app.js
```

## Notes / limits

- Anyone with a room URL can read, upload, and delete in it. Treat room names
  like passwords if you care about privacy on a shared LAN.
- Storage is the local filesystem — no DB, no auth, no quota. Use `--dir` to
  point at the volume you want.
- Bind address defaults to `0.0.0.0` so other devices on the LAN can reach
  it. Use `--host 127.0.0.1` for local-only.
