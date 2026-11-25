"""Vestry on Modal.

Deploy:  modal deploy modal_app.py
The database lives on Neon; its address, the site password and the API keys
are in the Modal secret "vestry". Photos live on the Modal volume "vestry-photos".
"""
import subprocess
import threading
import time

import modal

PORT = 4321

app = modal.App("vestry")
image = modal.Image.from_dockerfile("app/Dockerfile", context_dir="app", add_python="3.12")
photos = modal.Volume.from_name("vestry-photos", create_if_missing=True)


def save_photos_regularly():
    # Changes on a Modal volume are kept once committed; commit often so a
    # container that is shut down loses as little as possible.
    while True:
        time.sleep(30)
        try:
            photos.commit()
        except Exception as e:  # keep the server running whatever happens here
            print("photo save failed:", e)


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("vestry")],
    volumes={"/data": photos},
    env={"PHOTO_DIR": "/data/photos", "HOST": "0.0.0.0", "PORT": str(PORT)},
    # Generations run inside the server, so there must only ever be one.
    max_containers=1,
    # Sleep after an hour with no visits.
    scaledown_window=3600,
    timeout=3600,
    cpu=1.0,
    memory=1024,
)
@modal.concurrent(max_inputs=100)
@modal.web_server(PORT, startup_timeout=120)
def web():
    subprocess.Popen("cd /app && npm run migrate && npm start", shell=True)
    threading.Thread(target=save_photos_regularly, daemon=True).start()
