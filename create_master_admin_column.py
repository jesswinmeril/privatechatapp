# create_master_admin_column.py

import sqlite3
from werkzeug.security import generate_password_hash
import secrets

DB_PATH = 'users.db'  # Path to your SQLite DB file

def add_column_and_create_master_admin():
    conn = sqlite3.connect('users.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # 1. Add the column if it doesn't already exist
    cursor.execute("PRAGMA table_info(users)")
    columns = [col[1] for col in cursor.fetchall()]
    if "is_master_admin" not in columns:
        print("[DB] Adding 'is_master_admin' column...")
        cursor.execute("ALTER TABLE users ADD COLUMN is_master_admin INTEGER DEFAULT 0")
    else:
        print("[DB] Column 'is_master_admin' already exists.")

    # 2. Check if a master admin already exists
    cursor.execute("SELECT * FROM users WHERE is_master_admin = 1 LIMIT 1")
    if cursor.fetchone():
        print("[DB] Master admin already exists. No new user created.")
    else:
        print("[DB] Creating initial master admin account...")
        username = "masteradmin"
        password = "ChangeThisPassword!"  # Prompt to change later
        chat_id = secrets.token_hex(4)
        hash_pw = generate_password_hash(password)

        cursor.execute(
            "INSERT INTO users (username, password, role, chat_id, is_master_admin) VALUES (?, ?, ?, ?, ?)",
            (username, hash_pw, "admin", chat_id, 1)
        )
        print(f"[DB] Master admin '{username}' created with Chat ID: {chat_id}")
        print(f"[SECURITY] Change the password immediately on first login!")

    conn.commit()
    conn.close()
    print("[DB] Migration complete.")

if __name__ == "__main__":
    add_column_and_create_master_admin()
