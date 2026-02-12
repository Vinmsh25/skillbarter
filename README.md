# Link & Learn - Skill Barter Platform

A peer-to-peer learning platform where users can teach and learn skills using a credit-based system.

## Quick Start

### Option 1: Using Scripts (Recommended)
- **Start Development**: Double-click `start.bat` to launch both backend and frontend servers
- **Stop Development**: Double-click `stop.bat` to stop all servers

### Option 2: Manual Start

**Backend (Django + Channels):**
```bash
cd backend
.\venv\Scripts\activate
daphne -b 127.0.0.1 -p 8000 linklearn.asgi:application
```

**Frontend (React + Vite):**
```bash
cd frontend
npm run dev
```

## URLs
- **Frontend**: http://localhost:3000
- **Backend API**: http://127.0.0.1:8000/api/
- **Django Admin**: http://127.0.0.1:8000/admin/

## Tech Stack
- **Frontend**: React, TypeScript, Vite, Zustand
- **Backend**: Django, Django REST Framework, Channels, Daphne
- **Database**: SQLite (development)
- **Real-time**: WebSockets via Django Channels

## Features
- Credit-based skill exchange system
- Real-time sessions with video call, chat, code editor, and whiteboard
- User presence/online status
- Learning requests and matching
