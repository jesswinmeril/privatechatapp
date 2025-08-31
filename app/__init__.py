# my_flask_app/app/__init__.py

from flask import Flask
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_socketio import SocketIO
from .config import Config
from .routes import bp as routes_bp, is_token_revoked
from .jwt_handlers import (
    revoked_token_handler,
    expired_token_handler,
    invalid_token_handler,
    unauthorized_handler
)
from .error_handlers import register_error_handlers
from .sockets import register_socket_handlers
from .db import db
import logging

socketio = SocketIO(cors_allowed_origins="*")  # Singleton SocketIO instance

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    db.init_app(app)  # Initialize SQLAlchemy with app
    
    app.logger.setLevel(logging.DEBUG)

    CORS(app)

    socketio.init_app(app)  # Initialize with app

    jwt = JWTManager(app)
    @jwt.user_identity_loader
    def user_identity_lookup(user):
        # Return a string for the subject claim — use user_id as string
        return str(user["user_id"])

    @jwt.additional_claims_loader
    def add_claims(identity):
        # The identity here is the original user dict you passed when creating tokens
        # Attach other relevant user info as claims
        return {
            "username": identity["username"],
            "role": identity["role"],
            "chat_id": identity["chat_id"],
            "is_master_admin": identity["is_master_admin"]
        }
        
    jwt.token_in_blocklist_loader(is_token_revoked)
    jwt.revoked_token_loader(revoked_token_handler)
    jwt.expired_token_loader(expired_token_handler)
    jwt.invalid_token_loader(invalid_token_handler)
    jwt.unauthorized_loader(unauthorized_handler)

    app.register_blueprint(routes_bp)
    register_error_handlers(app)

    return app

register_socket_handlers(socketio)  # Register handlers once here
