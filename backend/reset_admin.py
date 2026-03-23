import sys
import os

# Ensure the backend directory is in the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models import User
from app.auth import get_password_hash

db = SessionLocal()
email = 'admin@salonpro.com'
user = db.query(User).filter(User.email == email).first()

if user:
    user.password = get_password_hash('admin123')
    db.commit()
    print("Password updated to admin123")
else:
    new_user = User(
        name='Admin',
        email=email,
        password=get_password_hash('admin123'),
        role='admin',
        is_active=1
    )
    db.add(new_user)
    db.commit()
    print("User created with password admin123")
