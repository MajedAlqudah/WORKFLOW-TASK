# Users App

A small full-stack app that lists users. The backend seeds three demo users
on first startup so the frontend always has data to show.

## Project Overview

- **Backend**: FastAPI service exposing `GET /users`, backed by PostgreSQL.
- **Frontend**: React + TypeScript app that fetches and displays the user list
  on demand.
- **Database**: PostgreSQL, auto-seeded with three demo users on first boot.

## Folder Structure

```
project-root/
│
├── backend/
│   ├── app/
│   │   ├── main.py       # FastAPI app, startup seeding, /users endpoint
│   │   ├── db.py         # engine, session, Base, get_db dependency
│   │   ├── model.py      # SQLAlchemy User model
│   │   └── schemas.py    # Pydantic response schemas
│   ├── Dockerfile
│   ├── pyproject.toml
│   └── .env
│
├── frontend/
│   ├── src/
│   │   ├── routes/
│   │   │   └── index.tsx # main page (button, list, loading/error states)
│   │   ├── api/
│   │   │   └── users.ts  # fetch client for the backend API
│   │   ├── App.tsx
│   │   └── main.tsx      # router + query client setup
│   ├── Dockerfile
│   ├── package.json
│   └── vite.config.ts
│
├── docker-compose.yml
├── README.md
└── .gitignore
```

## Technologies Used

**Backend**
- Python 3.13
- FastAPI
- SQLAlchemy 2.x
- PostgreSQL
- uv (package manager)
- Pydantic
- Uvicorn

**Frontend**
- React
- TypeScript
- Vite
- TanStack Query
- TanStack Router

## Running the Project

```bash
docker compose up --build
```

This starts three services: `db`, `backend`, and `frontend`. No manual
database setup is needed — tables are created and demo users are seeded
automatically on backend startup.

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- Swagger docs: http://localhost:8000/docs

## API Endpoint

### `GET /users`

Returns all users in the database.

```json
[
  {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "created_at": "2026-08-10T12:00:00",
    "updated_at": "2026-08-10T12:00:00"
  }
]
```
