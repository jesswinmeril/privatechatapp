# my_flask_app/app/routes.py

from flask import Blueprint, request, jsonify, current_app, render_template
from .db import get_db_connection
import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
    get_jwt,
    verify_jwt_in_request
)
import secrets

def generate_chat_id():
    return secrets.token_hex(4)  

bp = Blueprint('routes', __name__)

# In-memory token blacklist
blacklisted_tokens = set()

# GET all users (admin only)
@bp.route("/all_users", methods=["GET"])
@jwt_required()
def get_all_users():
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"error": "Admins only."}), 403

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, role, chat_id, is_master_admin, is_banned, is_muted FROM users")
    users = [
        dict(
            id=row["id"], username=row["username"], role=row["role"], chat_id=row["chat_id"], 
            is_master_admin=row["is_master_admin"], is_banned=row["is_banned"], is_muted=row["is_muted"]
        )
        for row in cursor.fetchall()
    ]
    conn.close()
    return jsonify({"users": users}), 200


# DELETE user (admin only)
@bp.route("/delete_user", methods=["POST"])
@jwt_required()
def delete_user():
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"error": "Admins only."}), 403

    data = request.get_json()
    username = data.get("username")
    if not username:
        return jsonify({"error": "Username missing."}), 400

    if username == claims.get("username"):
        return jsonify({"error": "Admins cannot delete themselves."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT is_master_admin FROM users WHERE username = ?", (username,))
    row = cursor.fetchone()
    if row and row["is_master_admin"]:
        conn.close()
        return jsonify({"error": "Cannot delete the master admin."}), 403

    cursor.execute("DELETE FROM users WHERE username = ?", (username,))
    conn.commit()
    conn.close()
    return jsonify({"message": f"User '{username}' deleted."}), 200


def is_token_revoked(jwt_header, jwt_payload):
    return jwt_payload["jti"] in blacklisted_tokens


@bp.route("/", methods=["GET"])
def index():
    return jsonify({"message": "Welcome!"})


# Role-based decorator
def jwt_role_required(role):
    def wrapper(fn):
        @wraps(fn)
        def decorator(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            if claims.get("role") != role:
                return jsonify({"error": "Access forbidden: Insufficient permissions."}), 403
            return fn(*args, **kwargs)
        return decorator
    return wrapper


# REGISTER
@bp.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    username = data.get("username", "").strip()
    password = data.get("password", "")
    role = data.get("role", "user").strip().lower()

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400
    if role not in ("user", "admin"):
        role = "user"

    chat_id = generate_chat_id()

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO users (username, password, role, chat_id) VALUES (?, ?, ?, ?)",
            (username, generate_password_hash(password), role, chat_id)
        )
        conn.commit()
        return jsonify({
            "message": f"Registered successfully as '{role}'.",
            "chat_id": chat_id,
        }), 201
    except sqlite3.IntegrityError:
        return jsonify({"error": "Username already exists or chat ID conflict"}), 400
    finally:
        conn.close()


# LOGIN
@bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username", "").strip()
    password = data.get("password", "")

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
    user = cursor.fetchone()
    conn.close()
    
    if user["is_banned"]:
        return jsonify({"error": "This account has been banned."}), 403


    if not user or not check_password_hash(user["password"], password):
        return jsonify({"error": "Invalid username or password"}), 401

    identity = {
        "user_id": user["id"],
        "username": user["username"],
        "role": user["role"],
        "chat_id": user["chat_id"],
        "is_master_admin": user["is_master_admin"]
    }

    access_token = create_access_token(identity=identity)
    refresh_token = create_refresh_token(identity=identity)

    return jsonify({
        "access_token": access_token,
        "refresh_token": refresh_token
    }), 200


# CHANGE USER ROLE (master admin only)
@bp.route("/change_role", methods=["POST"])
@jwt_required()
def change_role():
    claims = get_jwt()

    if not claims.get("is_master_admin"):
        return jsonify({"error": "Only the master admin can change user roles."}), 403

    data = request.get_json()
    username = data.get("username")
    new_role = data.get("role", "").strip().lower()

    if not username or new_role not in ("user", "admin"):
        return jsonify({"error": "Username and valid role ('user' or 'admin') required."}), 400

    if username == claims.get("username"):
        return jsonify({"error": "You cannot change your own role."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT is_master_admin FROM users WHERE username = ?", (username,))
    row = cursor.fetchone()
    if row and row["is_master_admin"]:
        conn.close()
        return jsonify({"error": "Cannot change role of another master admin."}), 403

    cursor.execute("UPDATE users SET role = ? WHERE username = ?", (new_role, username))
    conn.commit()
    conn.close()

    return jsonify({"message": f"Role for '{username}' updated to '{new_role}'."}), 200


# REFRESH TOKEN
@bp.route("/token/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh_access_token():
    import logging
    auth_header = request.headers.get("Authorization", None)
    current_app.logger.debug(f"[DEBUG] Refresh request. Auth: {auth_header}")
    claims = get_jwt()
    user_id = get_jwt_identity()
    current_app.logger.debug(f"[DEBUG] Refresh token for user_id={user_id} claims={claims}")
    access_token = create_access_token(identity={
        "user_id": user_id,
        "username": claims.get("username"),
        "role": claims.get("role"),
        "chat_id": claims.get("chat_id"),
        "is_master_admin": claims.get("is_master_admin")
    })
    return jsonify(access_token=access_token), 200


# LOGOUT
@bp.route("/logout", methods=["POST"])
@jwt_required(refresh=True)
def logout():
    jti = get_jwt()["jti"]
    blacklisted_tokens.add(jti)
    return jsonify({"message": "Refresh token revoked. Logged out."}), 200


# CURRENT USER INFO
@bp.route("/users", methods=["GET"])
@jwt_required()
def list_users():
    claims = get_jwt()
    return jsonify({
        "users": [
            {
                "username": claims.get("username"), 
                "role": claims.get("role"),
                "chat_id": claims.get("chat_id"),
                "is_master_admin": claims.get("is_master_admin")
            }
        ]
    })


# UPDATE PASSWORD
@bp.route("/update_password", methods=["POST"])
@jwt_required()
def update_password():
    user_id = get_jwt_identity()
    claims = get_jwt()

    data = request.get_json()
    current_password = data.get("current_password")
    new_password = data.get("new_password")
    if not new_password or len(new_password) < 6:
        return jsonify({"error": "Password must be at least 6 characters."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT password FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    if not row or not check_password_hash(row["password"], current_password):
        conn.close()
        return jsonify({"error": "Current password is incorrect."}), 401

    cursor.execute("UPDATE users SET password = ? WHERE id = ?", 
                   (generate_password_hash(new_password), user_id))
    conn.commit()
    conn.close()
    return jsonify({"message": "Password updated successfully."}), 200


# ADMIN-ONLY Reports
@bp.route("/all_reports", methods=["GET"])
@jwt_required()
def all_reports():
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"error": "Admins only."}), 403
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM reports ORDER BY timestamp DESC")
    reports = [
        dict(id=row["id"], reporter_id=row["reporter_id"], reported_id=row["reported_id"],
             reason=row["reason"], chat_log=row["chat_log"], timestamp=row["timestamp"])
        for row in cursor.fetchall()
    ]
    conn.close()
    return jsonify({"reports": reports}), 200

@bp.route("/admin_only", methods=["GET"])
@jwt_required()
@jwt_role_required("admin")
def admin_only():
    return jsonify({"message": "Hello, Admin. This route is restricted."})


@bp.route("/login-page", methods=["GET"])
def show_login_page():
    return render_template("login.html")

# BAN USER (admin only)
@bp.route("/ban_user", methods=["POST"])
@jwt_required()
def ban_user():
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"error": "Admins only."}), 403

    data = request.get_json()
    username = data.get("username")
    if not username:
        return jsonify({"error": "Username missing."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET is_banned = 1 WHERE username = ?", (username,))
    conn.commit()
    conn.close()

    return jsonify({"message": f"User '{username}' has been banned."}), 200


# MUTE USER (admin only)
@bp.route("/mute_user", methods=["POST"])
@jwt_required()
def mute_user():
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"error": "Admins only."}), 403

    data = request.get_json()
    username = data.get("username")
    if not username:
        return jsonify({"error": "Username missing."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET is_muted = 1 WHERE username = ?", (username,))
    conn.commit()
    conn.close()

    return jsonify({"message": f"User '{username}' has been muted."}), 200

# UNBAN USER (admin only)
@bp.route("/unban_user", methods=["POST"])
@jwt_required()
def unban_user():
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"error": "Admins only."}), 403

    data = request.get_json()
    username = data.get("username")
    if not username:
        return jsonify({"error": "Username missing."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET is_banned = 0 WHERE username = ?", (username,))
    conn.commit()
    conn.close()

    return jsonify({"message": f"User '{username}' has been unbanned."}), 200


# UNMUTE USER (admin only)
@bp.route("/unmute_user", methods=["POST"])
@jwt_required()
def unmute_user():
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"error": "Admins only."}), 403

    data = request.get_json()
    username = data.get("username")
    if not username:
        return jsonify({"error": "Username missing."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET is_muted = 0 WHERE username = ?", (username,))
    conn.commit()
    conn.close()

    return jsonify({"message": f"User '{username}' has been unmuted."}), 200
