# create_master_admin.py

from app import create_app, db
from app.models import User
from werkzeug.security import generate_password_hash

# Customize these values:
USERNAME = "masteradmin"
PASSWORD = "YourStrongPassword"   # Choose a secure password!
CHAT_ID = "masteradminid"         # Choose something unique

app = create_app()
with app.app_context():
    existing = User.query.filter_by(username=USERNAME).first()
    if existing:
        print(f"User '{USERNAME}' already exists. Updating to master admin...")
        existing.role = "admin"
        existing.is_master_admin = True
        existing.is_banned = False
        existing.is_muted = False
        existing.password = generate_password_hash(PASSWORD)
    else:
        master_admin = User(
            username=USERNAME,
            password=generate_password_hash(PASSWORD),
            role="admin",
            chat_id=CHAT_ID,
            is_master_admin=True,
            is_banned=False,
            is_muted=False
        )
        db.session.add(master_admin)
    db.session.commit()
    print(f"Master admin '{USERNAME}' is set up.")
