# my_flask_app/app/db.py

from flask_sqlalchemy import SQLAlchemy

# Create SQLAlchemy DB instance (singleton)
db = SQLAlchemy()
