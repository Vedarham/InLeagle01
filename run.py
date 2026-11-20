"""
InLEAGLE - Root Server Launcher
Usage:
    python run.py
"""
import os
import sys
from pathlib import Path
import uvicorn

_ROOT = Path(__file__).resolve().parent
_APP = _ROOT / "app"
for p in [str(_ROOT), str(_APP)]:
    if p not in sys.path:
        sys.path.insert(0, p)

if __name__ == "__main__":
    port = int(os.getenv("PORT", "7860"))
    print(f"Starting InLEAGLE on port {port}...")
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)
