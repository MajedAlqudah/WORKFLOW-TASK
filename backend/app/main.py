import csv
import io
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import Base, SessionLocal, engine, get_db
from app.model import User
from app.schemas import BulkDeleteRequest, UserCreate, UserResponse, UserUpdate

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("app")

DEMO_USERS = [
    {"name": "Majed Alqudah", "email": "majedjameel062@gmail.com"},
    {"name": "Waleed Allawi", "email": "waleedallawi00@gmail.com"},
    {"name": "Yousif Jarrar", "email": "YousifJar@gmail.com"},
]

limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])


def seed_demo_users(db: Session) -> None:
    if db.query(User).count() == 0:
        logger.info("No users found, seeding demo users")
        db.add_all(User(**data) for data in DEMO_USERS)
        db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up application")
    Base.metadata.create_all(bind=engine)
    logger.info("Connected to database and ensured tables exist")

    db = SessionLocal()
    try:
        seed_demo_users(db)
    finally:
        db.close()

    yield
    logger.info("Shutting down application")


app = FastAPI(title="Users API", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unexpected error while handling request: %s", request.url)
    return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})


@app.get("/users", response_model=list[UserResponse])
@limiter.limit("100/minute")
def get_users(request: Request, db: Session = Depends(get_db)):
    logger.info("Request received: GET /users")
    users = db.execute(select(User)).scalars().all()
    logger.info("Returning %d users", len(users))
    return users


@app.post("/users", response_model=UserResponse, status_code=201)
@limiter.limit("20/minute")
def create_user(request: Request, payload: UserCreate, db: Session = Depends(get_db)):
    logger.info("Request received: POST /users")
    user = User(name=payload.name, email=payload.email)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Email already exists")
    db.refresh(user)
    logger.info("Created user id=%d", user.id)
    return user


@app.get("/users/export")
@limiter.limit("10/minute")
def export_users(request: Request, db: Session = Depends(get_db)):
    logger.info("Request received: GET /users/export")
    users = db.execute(select(User)).scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "name", "email", "created_at", "updated_at"])
    for user in users:
        writer.writerow(
            [user.id, user.name, user.email, user.created_at, user.updated_at]
        )

    logger.info("Exported %d users to CSV", len(users))
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=users.csv"},
    )


@app.post("/users/import")
@limiter.limit("10/minute")
async def import_users(request: Request, file: UploadFile, db: Session = Depends(get_db)):
    logger.info("Request received: POST /users/import")
    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode()))

    try:
        users = [User(name=row["name"], email=row["email"]) for row in reader]
    except KeyError:
        raise HTTPException(
            status_code=400, detail="CSV must have 'name' and 'email' columns"
        )

    db.add_all(users)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="One or more emails already exist")

    logger.info("Imported %d users from CSV", len(users))
    return {"imported": len(users)}


@app.post("/users/bulk", response_model=list[UserResponse], status_code=201)
@limiter.limit("10/minute")
def bulk_create_users(request: Request, payload: list[UserCreate], db: Session = Depends(get_db)):
    logger.info("Request received: POST /users/bulk (%d users)", len(payload))
    users = [User(name=item.name, email=item.email) for item in payload]
    db.add_all(users)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="One or more emails already exist")
    for user in users:
        db.refresh(user)
    logger.info("Bulk created %d users", len(users))
    return users


@app.post("/users/bulk-delete")
@limiter.limit("10/minute")
def bulk_delete_users(request: Request, payload: BulkDeleteRequest, db: Session = Depends(get_db)):
    logger.info("Request received: POST /users/bulk-delete (%d ids)", len(payload.ids))
    deleted = (
        db.query(User)
        .filter(User.id.in_(payload.ids))
        .delete(synchronize_session=False)
    )
    db.commit()
    logger.info("Bulk deleted %d users", deleted)
    return {"deleted": deleted}


@app.put("/users/{user_id}", response_model=UserResponse)
@limiter.limit("20/minute")
def update_user(request: Request, user_id: int, payload: UserUpdate, db: Session = Depends(get_db)):
    logger.info("Request received: PUT /users/%d", user_id)
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    user.name = payload.name
    user.email = payload.email
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Email already exists")
    db.refresh(user)
    logger.info("Updated user id=%d", user.id)
    return user


@app.delete("/users/{user_id}", status_code=204)
@limiter.limit("20/minute")
def delete_user(request: Request, user_id: int, db: Session = Depends(get_db)):
    logger.info("Request received: DELETE /users/%d", user_id)
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user)
    db.commit()
    logger.info("Deleted user id=%d", user_id)
