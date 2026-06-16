# MealPlan

A personal meal prep planner that eliminates decision fatigue, reduces food waste through vegetable-first planning, and optimizes Sunday prep with cross-recipe ingredient batching.

## Features

- **Recipe Import** — Import recipes from URLs (BBC Good Food), RecipeKeeper HTML exports, or cookbook photos (OCR)
- **AI Recipe Parsing** — GPT-4o decomposes recipes into structured steps with per-step ingredient assignments
- **Recipe Box** — Browse, search, edit, and delete your imported recipes
- **Vegetable-First Meal Planning** — Pick an anchor recipe; AI suggests 3-4 complementary meals that share vegetables
- **Grocery List** — Auto-generated, categorized, consolidated shopping list with checkboxes
- **Prep Day Guide** — Two-section Sunday prep guide:
  - Section 1: Raw prep tasks batched across recipes with container portioning
  - Section 2: Cook-ahead tasks for make-ahead meals with storage and reheat info
- **Today's View** — Opens to tonight's recipe, adapting display based on make-ahead type

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.10 + FastAPI |
| Frontend | React 19 + Vite + Tailwind CSS 4 |
| Database | PostgreSQL 17 |
| ORM | SQLAlchemy (async) + Alembic |
| AI | OpenAI GPT-4o |
| OCR | pytesseract + OpenCV |

## Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL 17

### Database

```bash
psql -U postgres -c "CREATE DATABASE mealplan;"
```

### Backend

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate      # Windows
# source .venv/bin/activate  # macOS/Linux

pip install -r requirements.txt

# Configure environment
cp .env.example .env  # then edit DATABASE_URL and OPENAI_API_KEY

# Run migrations
alembic upgrade head

# Start server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend

```bash
# From project root
npm install
npm run dev
```

The app runs at `http://localhost:5173` with the API at `http://localhost:8000`.

### Reopening the app

Recipes are stored in **PostgreSQL**. When you close and reopen the app (or your machine), you need to have these running again or the Recipe Box will be empty:

1. **PostgreSQL** — ensure the service is running (e.g. Windows Services, or start your DB server).
2. **Backend** — from `backend/`: `.venv\Scripts\activate` then `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`.
3. **Frontend** (optional) — from project root: `npm run dev`.

If the Recipe Box shows “Couldn’t load recipes”, start PostgreSQL and the backend, then click **Retry** or refresh the page.

### Environment Variables

Create `backend/.env`:

```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/mealplan
OPENAI_API_KEY=sk-...
DEBUG=true
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
JWT_SECRET=generate-a-long-random-string
ALLOWED_EMAIL=hayeson@gmail.com
```

Create `.env` in the project root for the frontend:

```env
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_OPENROUTER_API_KEY=your-key-here
```

Use the **same** Google OAuth client ID in both files. Sign-in is restricted to `hayeson@gmail.com` on the server.

### Google OAuth setup

1. Open [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create an **OAuth 2.0 Client ID** (Web application)
3. Add authorized JavaScript origins:
   - `http://localhost:5173` (local dev)
   - `https://your-production-url.onrender.com` (after deploy)
4. Copy the client ID into `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID`

## Deploy to the web (Render)

The repo includes a production `Dockerfile` (builds the React app + serves it from FastAPI) and `render.yaml`.

1. Push this repo to GitHub
2. In [Render](https://render.com), create a **Blueprint** from `render.yaml`
3. Set these environment variables on the web service:
   - `GOOGLE_CLIENT_ID` — your Google OAuth client ID
   - `VITE_GOOGLE_CLIENT_ID` — same value (used at Docker build time)
   - `OPENAI_API_KEY` — your OpenAI / OpenRouter key
   - `CORS_ORIGINS` — your Render URL, e.g. `https://mealplan-xxxx.onrender.com`
4. After the first deploy, add that same URL to Google OAuth authorized origins
5. Open the Render URL and sign in with `hayeson@gmail.com`

Local production-like test:

```bash
docker compose up --build
```

Then visit `http://localhost:8000`.

**TikTok / Instagram import:** paste a post URL on the Import page. Tier 2 video extraction (audio transcription + on-screen text) requires [ffmpeg](https://ffmpeg.org/) on your PATH. For Instagram reliability, export browser cookies to a Netscape-format file and set `INSTAGRAM_COOKIES_FILE` in `backend/.env`.

## API Documentation

With the backend running, visit `http://localhost:8000/docs` for the interactive Swagger UI.

## Project Structure

```
MealPlan/
├── backend/
│   ├── app/
│   │   ├── main.py           — FastAPI app entry point
│   │   ├── config.py         — Settings from .env
│   │   ├── database.py       — Async SQLAlchemy engine
│   │   ├── models/           — ORM models (recipes, ingredients, meal plans)
│   │   ├── schemas/          — Pydantic request/response models
│   │   ├── routers/          — API route handlers
│   │   └── services/         — Business logic (AI parser, scraper, planner, etc.)
│   ├── alembic/              — Database migrations
│   └── requirements.txt
├── src/
│   ├── pages/                — React page components
│   ├── components/           — Shared UI components
│   ├── api/                  — Backend API client
│   └── types/                — TypeScript type definitions
├── PLANNING.md
├── ARCHITECTURE.md
├── ROADMAP.md
└── USER_STORIES.md
```
