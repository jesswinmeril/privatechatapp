Hello, everyone.

This is my first major fullstack project as a developer.
I hope it's useful.

# Private Chat App

A real-time private chat web application built with Flask, Flask-SocketIO, JWT authentication, and SQLite database. Users can register, login, chat privately, and admins can manage users and reports.

## Features

- User registration and login with JWT-based authentication
- Real-time private messaging using WebSockets (Socket.IO)
- Admin panel for user moderation (ban, mute, delete, role management)
- Reporting system for chat incidents
- Secure password hashing and token revocation support
- Responsive single-page application frontend

## Tech Stack

- Backend: Python, Flask, Flask-SocketIO, Flask-JWT-Extended
- Frontend: JavaScript, Bootstrap 5, Socket.IO client
- Database: SQLite (for demo and development), SQLAlchemy
- Deployment: Easily deployable

## Getting Started

### Prerequisites

- Python 3.8+
- Virtual environment (recommended)
- SQLite3

### Installation

1. Clone the repository:
git clone https://github.com/yourusername/privatechatapp.git   
2. Create and activate a virtual environment:
cd privatechatapp
python -m venv venv
source venv/bin/activate      # or venv\Scripts\activate on Windows
3. Install dependencies:
pip install -r requirements.txt
4. Set environment variables in a `.env` file (do NOT commit `.env`):
cp .env.example .env          # create .env file and fill in variables
5. Run the application (development mode):
python run.py
6. Access the app at `http://localhost:8000`
7. (Optional) I have included admin and masteradmin features, they're not really necessary but you can use them if you want to, just run the create_master_admin.py script once in your virtual environment after you've started the app, then promote the users you want to admin.

## Usage

- Register a new user or login.
- If you have another user's chat ID and they're online, you can request chat with them.
- Use the chat interface to send private messages.
- Admin users can access the admin panel for moderation.

## Deployment

This app can be deployed using Render, Heroku, Fly.io, AWS or other Python hosting services(I used Render, https://render.com , it's really beginner friendly and free).

## Project Structure

root/ 
├── app/ 
│   ├── init.py
│   ├── config.py 
│   ├── db.py
│   ├── error_handlers.py
│   ├── jwt_handlers.py
│   ├── models.py
│   ├── routes.py
│   ├── sockets.py
│   ├── static/
│   │   ├── login.js
│   │   └── styles.css
│   └── templates/
│       └── login.html
├── create_master_admin.py
├── .env (app secrets, DO NOT COMMIT TO GIT)
├── .gitignore
├── requirements.txt
├── run.py(for dev purposes only)
└── wsgi.py


## Security

- Keep `.env` file secret and never commit it.
- Use strong secret keys for production.
- Consider switching to a production-grade database.

## Contributing

Contributions are welcome. Please fork the repo and submit pull requests.

*This README was created with AI assistance.*
