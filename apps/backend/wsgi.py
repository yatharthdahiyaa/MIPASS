"""WSGI entry point for the Flask API.

    python wsgi.py                 # http://127.0.0.1:8080 (override with PORT / HOST)
    FLASK_RELOAD=1 python wsgi.py  # also restart on code changes (development only)
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
        # Off by default: a reload kills requests in flight, and an X-ray analysis takes 10-20 s,
        # so an edit (or an editor touching a library file) mid-upload showed "Analysis failed".
        # The reloader also keeps the first process's environment, so .env edits need a full restart.
        use_reloader=os.getenv("FLASK_RELOAD", "0").lower() in ("1", "true", "yes"),
    )
