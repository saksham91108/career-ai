# Career-AI — Resume Intelligence Platform

Full-stack app that analyzes resumes against target job roles, scores them,
gives AI-generated feedback, and includes an AI career chat mentor.

## Stack
- **Frontend:** React + Vite + TypeScript + Tailwind CSS
- **Backend:** FastAPI + SQLAlchemy + Alembic
- **AI:** Groq (Llama 3.3 70B) for feedback generation and chat
- **Auth:** Email OTP verification + JWT

## Project structure
```
career-ai/
├── frontend/     # React app
└── backend/      # FastAPI app
```

## Running locally

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env           # then fill in real values
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env            # then set VITE_API_URL if needed
npm run dev
```

Frontend runs on `http://localhost:3000`, backend on `http://localhost:8000`.

## Environment variables

**backend/.env**
- `SECRET_KEY` — JWT signing secret
- `GROQ_API_KEY` — Groq API key for AI feedback/chat
- `DATABASE_URL` — defaults to local SQLite; use Postgres in production
- `GMAIL_USER` / `GMAIL_APP_PASSWORD` — for sending OTP emails
- `ALLOWED_ORIGINS` — comma-separated allowed CORS origins

**frontend/.env**
- `VITE_API_URL` — full URL of the backend API (e.g. `https://your-backend.onrender.com/api/v1`)

## Deployment
- Frontend → Vercel
- Backend → Render (Web Service + Postgres)
