# Link & Learn - Django Backend

A peer-to-peer learning platform backend built with Django 5, Django REST Framework, and Django Channels.

## Features

- **JWT Authentication**: Secure user authentication with SimpleJWT
- **Credit System**: 5 minutes teaching = 1 credit, 10% bank cut
- **Learning Posts**: Dynamic topic-based learning requests
- **Real-time Sessions**: WebSocket-based timer sync and chat
- **Reviews**: Public rating system for users

## Tech Stack

- Python 3.11+
- Django 5.0
- Django REST Framework
- SimpleJWT
- Django Channels
- Redis (for WebSockets)
- SQLite (dev) / PostgreSQL (prod)

## Quick Start

### 1. Create Virtual Environment

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Environment Setup (Optional)

Create a `.env` file in the backend directory:

```env
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
USE_IN_MEMORY_CHANNEL_LAYER=True
```

> **Note**: Set `USE_IN_MEMORY_CHANNEL_LAYER=True` if you don't have Redis installed for local development.

### 4. Run Migrations

```bash
python manage.py makemigrations
python manage.py migrate
```

### 5. Create Superuser (Optional)

```bash
python manage.py createsuperuser
```

### 6. Start Development Server

**HTTP Server (standard):**
```bash
python manage.py runserver
```

**ASGI Server (for WebSockets):**
```bash
daphne -p 8000 linklearn.asgi:application
```

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup/` | Register new user |
| POST | `/api/auth/login/` | Login user |
| POST | `/api/auth/token/refresh/` | Refresh JWT token |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/me/` | Get current user profile |
| PATCH | `/api/users/me/` | Update profile |
| GET | `/api/users/{id}/reviews/` | Get user's reviews |

### Learning Posts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/posts/` | List active posts |
| POST | `/api/posts/` | Create learning post |
| GET | `/api/posts/{id}/` | Get post details |
| PATCH | `/api/posts/{id}/complete/` | Mark post completed |
| GET | `/api/posts/my_posts/` | Get my active posts |

### Sessions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sessions/` | List user's sessions |
| POST | `/api/sessions/` | Create session |
| GET | `/api/sessions/{id}/` | Get session details |
| POST | `/api/sessions/{id}/timer/start/` | Start teaching timer |
| POST | `/api/sessions/{id}/timer/stop/` | Stop teaching timer |
| POST | `/api/sessions/{id}/end/` | End session |
| POST | `/api/sessions/{id}/reviews/` | Submit review |

### Bank

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bank/support/` | Check support eligibility |
| POST | `/api/bank/support/` | Request support credits |

## WebSocket Endpoints

Connect with JWT token: `ws://host/ws/path/?token=<jwt_token>`

| Endpoint | Description |
|----------|-------------|
| `ws://host/ws/presence/` | Online/offline status |
| `ws://host/ws/chat/{session_id}/` | Session chat |
| `ws://host/ws/session/{session_id}/` | Timer sync & credits |

## Credit System Rules

- **New users**: 15 credits on signup
- **Teaching**: 5 minutes = 1 credit earned
- **Bank cut**: 10% from every teaching transaction
- **Support credits**:
  - 0 credits → 6 credits
  - 1-2 credits → 4 credits
  - 3 credits → 2 credits
  - >3 credits → not eligible
  - Cooldown: 24 hours between requests

## Project Structure

```
backend/
├── manage.py
├── requirements.txt
├── README.md
├── linklearn/                 # Django project
│   ├── __init__.py
│   ├── settings.py
│   ├── urls.py
│   ├── asgi.py
│   └── wsgi.py
└── core/                      # Main app
    ├── models/
    │   ├── user.py
    │   ├── learning_request.py
    │   ├── session.py
    │   ├── review.py
    │   └── credit.py
    ├── serializers/
    ├── views/
    ├── consumers/
    │   ├── presence.py
    │   ├── chat.py
    │   └── session.py
    ├── urls.py
    ├── routing.py
    └── middleware.py
```

## Testing the API

### Signup

```bash
curl -X POST http://localhost:8000/api/auth/signup/ \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User","password":"SecurePass123!","password_confirm":"SecurePass123!"}'
```

### Login

```bash
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!"}'
```

### Create Learning Post

```bash
curl -X POST http://localhost:8000/api/posts/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{"topic_to_learn":"Python","topic_to_teach":"JavaScript","ok_with_just_learning":false}'
```

## Expected Output

When you start the server with `python manage.py runserver`:

```
Watching for file changes with StatReloader
Performing system checks...

System check identified no issues (0 silenced).
February 03, 2026 - 00:00:00
Django version 5.0.1, using settings 'linklearn.settings'
Starting development server at http://127.0.0.1:8000/
Quit the server with CTRL-BREAK.
```

## License

MIT
