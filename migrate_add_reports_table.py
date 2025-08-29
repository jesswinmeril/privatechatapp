# migrate_add_reports_table.py

import sqlite3

DB_PATH = 'users.db'  # Path to your SQLite database file

def create_reports_table():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Check if 'reports' table exists
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='reports';"
    )
    if cursor.fetchone():
        print("[DB] 'reports' table already exists — nothing to do.")
        conn.close()
        return

    # Create the reports table
    cursor.execute(
        """
        CREATE TABLE reports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          reporter_id TEXT,
          reported_id TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          reason TEXT,
          chat_log TEXT
        );
        """
    )
    conn.commit()
    conn.close()
    print("[DB] 'reports' table created successfully.")

if __name__ == "__main__":
    create_reports_table()
