from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# ── Create app and CORS FIRST so it always responds ──────────────
app = FastAPI(title="Salon Customer Management System API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://salonn-six.vercel.app",
    ],
    allow_origin_regex=r"https://salonn-.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Database setup (wrapped so app starts even if DB fails) ──────
try:
    from sqlalchemy import text, inspect
    from .database import engine, DATABASE_URL
    from . import models

    is_postgres = DATABASE_URL.startswith("postgresql")
    logger.info(f"Database: {'PostgreSQL' if is_postgres else 'SQLite'}")
    logger.info(f"DATABASE_URL starts with: {DATABASE_URL[:20]}...")

    # Create all database tables
    models.Base.metadata.create_all(bind=engine)
    logger.info("Tables created successfully")

    # Migrate: add new columns if missing
    try:
        with engine.connect() as conn:
            inspector = inspect(engine)
            columns = [col['name'] for col in inspector.get_columns('appointments')]
            if 'assigned_staff_id' not in columns:
                conn.execute(text('ALTER TABLE appointments ADD COLUMN assigned_staff_id INTEGER REFERENCES users(id)'))
            if 'payment_status' not in columns:
                conn.execute(text("ALTER TABLE appointments ADD COLUMN payment_status VARCHAR DEFAULT 'unpaid'"))
            if 'completed_at' not in columns:
                if is_postgres:
                    conn.execute(text('ALTER TABLE appointments ADD COLUMN completed_at TIMESTAMP'))
                else:
                    conn.execute(text('ALTER TABLE appointments ADD COLUMN completed_at DATETIME'))
            # Users table migrations
            user_columns = [col['name'] for col in inspector.get_columns('users')]
            if 'phone' not in user_columns:
                conn.execute(text('ALTER TABLE users ADD COLUMN phone VARCHAR'))
            if 'is_active' not in user_columns:
                conn.execute(text('ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1'))

            # Appointments: add paid_amount column if missing
            if 'paid_amount' not in columns:
                conn.execute(text('ALTER TABLE appointments ADD COLUMN paid_amount NUMERIC(10,2) DEFAULT 0'))
                conn.execute(text("UPDATE appointments SET paid_amount = total_amount WHERE payment_status = 'paid'"))

            # Appointment_services: migrate to new schema with id PK and nullable service_id
            as_columns = [col['name'] for col in inspector.get_columns('appointment_services')]
            if 'id' not in as_columns:
                if is_postgres:
                    conn.execute(text('''
                        CREATE TABLE appointment_services_new (
                            id SERIAL PRIMARY KEY,
                            appointment_id INTEGER NOT NULL REFERENCES appointments(id),
                            service_id INTEGER REFERENCES services(id),
                            service_name VARCHAR,
                            price_at_booking NUMERIC(10,2)
                        )
                    '''))
                else:
                    conn.execute(text('''
                        CREATE TABLE appointment_services_new (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            appointment_id INTEGER NOT NULL REFERENCES appointments(id),
                            service_id INTEGER REFERENCES services(id),
                            service_name VARCHAR,
                            price_at_booking NUMERIC(10,2)
                        )
                    '''))
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

            # Appointments: add payment_mode column
            if 'payment_mode' not in columns:
                conn.execute(text('ALTER TABLE appointments ADD COLUMN payment_mode VARCHAR'))

            # Appointments: add package_name column
            if 'package_name' not in columns:
                conn.execute(text('ALTER TABLE appointments ADD COLUMN package_name VARCHAR'))

            # Services: add parent_id and sub_category columns
            service_columns = [col['name'] for col in inspector.get_columns('services')]
            if 'parent_id' not in service_columns:
                conn.execute(text('ALTER TABLE services ADD COLUMN parent_id INTEGER REFERENCES services(id)'))
            if 'sub_category' not in service_columns:
                conn.execute(text('ALTER TABLE services ADD COLUMN sub_category VARCHAR'))

            # Services: add length-based pricing columns
            if 'is_length_based' not in service_columns:
                conn.execute(text('ALTER TABLE services ADD COLUMN is_length_based INTEGER DEFAULT 0'))
            if 'price_short' not in service_columns:
                conn.execute(text('ALTER TABLE services ADD COLUMN price_short NUMERIC(10,2)'))
            if 'price_medium' not in service_columns:
                conn.execute(text('ALTER TABLE services ADD COLUMN price_medium NUMERIC(10,2)'))
            if 'price_long' not in service_columns:
                conn.execute(text('ALTER TABLE services ADD COLUMN price_long NUMERIC(10,2)'))
            if 'price_extra_long' not in service_columns:
                conn.execute(text('ALTER TABLE services ADD COLUMN price_extra_long NUMERIC(10,2)'))

            conn.commit()
        logger.info("Migrations completed successfully")
    except Exception as e:
        logger.error(f"Migration error (app will still run): {e}")

except Exception as e:
    logger.error(f"Database setup error: {e}")

# ── Routes ──────────────────────────────────────��────────────────
from .routes import auth, customers, services, appointments, dashboard, reports, users, packages

app.include_router(auth.router)
app.include_router(customers.router)
app.include_router(services.router)
app.include_router(appointments.router)
app.include_router(dashboard.router)
app.include_router(reports.router)
app.include_router(users.router)
app.include_router(packages.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to SCMS API"}

@app.get("/health")
def health_check():
    """Health check endpoint - always responds even if DB is down."""
    import os
    db_url = os.getenv("DATABASE_URL", "not set")
    # Mask the password
    if "@" in db_url:
        parts = db_url.split("@")
        db_url = "***@" + parts[-1]
    return {
        "status": "ok",
        "database_url_prefix": db_url[:30] if len(db_url) > 30 else db_url,
    }
