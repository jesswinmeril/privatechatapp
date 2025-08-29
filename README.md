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
- Database: SQLite (for demo and development)
- Deployment: Easily deployable on AWS Elastic Beanstalk or similar

## Getting Started

### Prerequisites

- Python 3.8+
- Virtual environment (recommended)
- SQLite3

### Installation

1. Clone the repository:
2. Create and activate a virtual environment:
3. Install dependencies:
4. Set environment variables in a `.env` file (do NOT commit `.env`):
5. Run the application (development mode):
6. Access the app at `http://localhost:8000`

## Usage

- Register a new user or login.
- Use the chat interface to send private messages.
- Admin users can access the admin panel for moderation.

## Deployment

This app can be deployed using AWS Elastic Beanstalk or other Python hosting services.

## Project Structure

root/ 
├── app/ 
│   ├── init.py
│   ├── config.py 
│   ├── db.py
│   ├── error_handlers.py
│   ├── jwt_handlers.py
│   ├── routes.py
│   ├── sockets.py
│   ├── static/
│   │   ├── login.js
│   │   └── styles.css
│   └── templates/
│       └── login.html
├── .env 
├── .gitignore
├── requirements.txt
├── run.py
└── wsgi.py


## Security

- Keep `.env` file secret and never commit it.
- Use strong secret keys for production.
- Consider switching to a production-grade database.

## Contributing

Contributions are welcome. Please fork the repo and submit pull requests.

*This README was created with AI assistance.*
