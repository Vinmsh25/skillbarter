import subprocess
import time
import os
import signal
import sys
import webbrowser
from pathlib import Path

# Configuration
PROJECT_ROOT = Path(__file__).parent.absolute()
BACKEND_DIR = PROJECT_ROOT / "backend"
FRONTEND_DIR = PROJECT_ROOT / "frontend"
VENV_PYTHON = BACKEND_DIR / "venv" / "Scripts" / "python.exe"

# Commands
if VENV_PYTHON.exists():
    BACKEND_CMD = [str(VENV_PYTHON), "manage.py", "runserver"]
else:
    print(f"Warning: Virtual environment not found at {VENV_PYTHON}. Using system 'python'.")
    BACKEND_CMD = ["python", "manage.py", "runserver"]

FRONTEND_CMD = ["npm", "run", "dev"]
FRONTEND_URL = "http://localhost:5173"

def graceful_shutdown(signum, frame):
    print("\n\n🛑 Shutting down servers...")
    # Terminate processes
    if 'backend_process' in globals() and backend_process:
        backend_process.terminate()
    if 'frontend_process' in globals() and frontend_process:
        # On Windows, terminating the npm wrapper might not kill the node process.
        # We might need a more aggressive kill if specific issues arise, but terminate is standard.
        frontend_process.terminate()
    print("✅ Servers stopped.")
    sys.exit(0)

# Handle Ctrl+C
signal.signal(signal.SIGINT, graceful_shutdown)
signal.signal(signal.SIGTERM, graceful_shutdown)

print(f"🚀 Starting Link & Learn Project...")
print(f"📂 Project Root: {PROJECT_ROOT}")

# Start Backend
print(f"🐍 Starting Backend ({BACKEND_CMD[0]})...")
backend_process = subprocess.Popen(
    BACKEND_CMD,
    cwd=BACKEND_DIR,
    shell=False # Direct execution is better if we have the executable path
)

# Start Frontend
print(f"⚛️  Starting Frontend (npm run dev)...")
# Shell=True is often needed for npm on Windows to find the executable/cmd
frontend_process = subprocess.Popen(
    FRONTEND_CMD,
    cwd=FRONTEND_DIR,
    shell=True
)

# Wait for servers to spin up (simple delay)
print("⏳ Waiting for servers to initialize...")
time.sleep(5) 

# Open Browser
print(f"🌍 Opening browser at {FRONTEND_URL}")
webbrowser.open(FRONTEND_URL)

print("\n✨ Project is running! Press Ctrl+C to stop both servers.\n")

# Keep the script running to monitor processes
try:
    # Wait for either process to exit (which means an error occurred or manual stop)
    while True:
        if backend_process.poll() is not None:
            print("❌ Backend process triggered unexpected exit.")
            break
        if frontend_process.poll() is not None:
            print("❌ Frontend process triggered unexpected exit.")
            break
        time.sleep(1)
except KeyboardInterrupt:
    graceful_shutdown(None, None)
finally:
    graceful_shutdown(None, None)
