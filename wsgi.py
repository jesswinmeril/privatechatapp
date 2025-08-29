#my_flask_app/wsgi.py

from app import create_app
from dotenv import load_dotenv

load_dotenv()  # Load environment variables from .env file

app = create_app()
