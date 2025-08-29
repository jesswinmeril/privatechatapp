# my_flask_app/app/jwt_handlers.py

from flask import jsonify
from flask import current_app

def revoked_token_handler(jwt_header, jwt_payload):
    current_app.logger.warning(f"[JWT] Revoked token used. Payload: {jwt_payload}")
    return jsonify({"error": "This token has been revoked."}), 401

def expired_token_handler(jwt_header, jwt_payload):
    current_app.logger.warning(f"[JWT] Expired token used. Payload: {jwt_payload}")
    return jsonify({"error": "Token has expired."}), 401

def invalid_token_handler(error_string):
    current_app.logger.warning(f"[JWT] Invalid token. Reason: {error_string}")
    return jsonify({"error": "Invalid token."}), 401

def unauthorized_handler(error_string):
    current_app.logger.warning(f"[JWT] Unauthorized request. Reason: {error_string}")
    return jsonify({"error": "Missing or invalid authorization."}), 401
