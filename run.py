#my_flask_app/run.py
# For development/testing only. Use wsgi.py with Gunicorn in production.

from dotenv import load_dotenv
load_dotenv() 

from app import create_app, socketio  # ⬅ make sure socketio is imported from __init__.py

app = create_app()

if __name__ == "__main__":
    socketio.run(app, port=8000)
