# my_flask_app/app/error_handlers.py

from flask import jsonify, current_app
from flask_jwt_extended.exceptions import JWTExtendedException

def register_error_handlers(app):
    @app.errorhandler(Exception)
    def handle_unexpected_error(error):
        # Don’t intercept JWT-related errors — let Flask-JWT-Extended handle them
        if isinstance(error, JWTExtendedException):
            raise error

        current_app.logger.error(f"[Unhandled Exception] {error}")
        return jsonify({"error": "Something went wrong."}), 500
