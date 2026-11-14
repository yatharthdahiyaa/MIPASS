"""WSGI entry point for the Flask API.

    python wsgi.py                 # http://127.0.0.1:8080 (override with PORT / HOST)
    gunicorn "wsgi:app"            # production (see Dockerfile)
"""

import os

from app import create_app

app = create_app()

if __name__ == "__main__":
    app.run(
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8080")),
        debug=os.getenv("FLASK_ENV", "development") == "development",
        threaded=True,
    )
