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

    # Appointment_services: migrate to new schema with id PK and nullable service_id
    as_columns = [col['name'] for col in inspector.get_columns('appointment_services')]
    if 'id' not in as_columns:
        # Restructure table: old schema had composite PK (appointment_id, service_id)
        # New schema has auto-increment id PK with nullable service_id
        conn.execute(text('''
            CREATE TABLE appointment_services_new (
                id SERIAL PRIMARY KEY,
                appointment_id INTEGER NOT NULL REFERENCES appointments(id),
                service_id INTEGER REFERENCES services(id),
                service_name VARCHAR,
                price_at_booking NUMERIC(10,2)
            )
        '''))
        # Copy existing data (add snapshot columns if they exist in old table)
        if 'service_name' in as_columns:
            conn.execute(text('''
                INSERT INTO appointment_services_new (appointment_id, service_id, service_name, price_at_booking)
                SELECT appointment_id, service_id, service_name, price_at_booking FROM appointment_services
            '''))
        else:
            conn.execute(text('''
                INSERT INTO appointment_services_new (appointment_id, service_id)
                SELECT appointment_id, service_id FROM appointment_services
            '''))
        conn.execute(text('DROP TABLE appointment_services'))
        conn.execute(text('ALTER TABLE appointment_services_new RENAME TO appointment_services'))
    elif 'service_name' not in as_columns:
        conn.execute(text('ALTER TABLE appointment_services ADD COLUMN service_name VARCHAR'))
    if 'id' in [col['name'] for col in inspector.get_columns('appointment_services')] and 'price_at_booking' not in [col['name'] for col in inspector.get_columns('appointment_services')]:
        conn.execute(text('ALTER TABLE appointment_services ADD COLUMN price_at_booking NUMERIC(10,2)'))

    # Backfill existing records that have no snapshot data
    conn.execute(text('''
        UPDATE appointment_services
        SET service_name = (SELECT name FROM services WHERE services.id = appointment_services.service_id),
            price_at_booking = (SELECT price FROM services WHERE services.id = appointment_services.service_id)
        WHERE (service_name IS NULL OR price_at_booking IS NULL) AND service_id IS NOT NULL
    '''))

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
