from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text, inspect
from .database import engine
from . import models

# Create all database tables
models.Base.metadata.create_all(bind=engine)

# Migrate: add new columns if missing
with engine.connect() as conn:
    inspector = inspect(engine)
    columns = [col['name'] for col in inspector.get_columns('appointments')]
    if 'assigned_staff_id' not in columns:
        conn.execute(text('ALTER TABLE appointments ADD COLUMN assigned_staff_id INTEGER REFERENCES users(id)'))
    if 'payment_status' not in columns:
        conn.execute(text("ALTER TABLE appointments ADD COLUMN payment_status VARCHAR DEFAULT 'unpaid'"))
    if 'completed_at' not in columns:
        conn.execute(text('ALTER TABLE appointments ADD COLUMN completed_at DATETIME'))
    # Users table migrations
    user_columns = [col['name'] for col in inspector.get_columns('users')]
    if 'phone' not in user_columns:
        conn.execute(text('ALTER TABLE users ADD COLUMN phone VARCHAR'))
    if 'is_active' not in user_columns:
        conn.execute(text('ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1'))
    conn.commit()

from .routes import auth, customers, services, appointments, dashboard, reports, users

app = FastAPI(title="Salon Customer Management System API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(customers.router)
app.include_router(services.router)
app.include_router(appointments.router)
app.include_router(dashboard.router)
app.include_router(reports.router)
app.include_router(users.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to SCMS API"}
