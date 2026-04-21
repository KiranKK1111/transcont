"""Command-line entrypoint for EnvPad."""
from __future__ import annotations

import argparse
import sys


def main(argv=None) -> int:
    p = argparse.ArgumentParser(
        prog="envpad",
        description="Self-hosted persistent notes with a slug-routed workspace.",
    )
    p.add_argument("--host", default="0.0.0.0", help="Bind address (default 0.0.0.0)")
    p.add_argument("--port", type=int, default=8080, help="Port (default 8080)")
    args = p.parse_args(argv)

    import uvicorn
    from .server import create_app

    app = create_app()

    print(f"[envpad] open : http://{args.host}:{args.port}/")
    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")
    return 0


if __name__ == "__main__":
    sys.exit(main())
