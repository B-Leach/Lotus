"""
Bootstrap script to start the FastAPI app with uvicorn.
Used by Lambda Web Adapter.
"""

import subprocess
import sys

if __name__ == "__main__":
    subprocess.run(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "index:app",
            "--host",
            "0.0.0.0",
            "--port",
            "8000",
        ]
    )
