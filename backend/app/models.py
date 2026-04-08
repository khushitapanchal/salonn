from sqlalchemy import Column, Integer, String, Date, Time, Text, ForeignKey, Numeric, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class AppointmentService(Base):
    __tablename__ = 'appointment_services'
    id = Column(Integer, primary_key=True, autoincrement=True)
    appointment_id = Column(Integer, ForeignKey('appointments.id'), nullable=False)
    service_id = Column(Integer, ForeignKey('services.id'), nullable=True)
    service_name = Column(String, nullable=True)
    price_at_booking = Column(Numeric(10, 2), nullable=True)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    password = Column(String)
    phone = Column(String, nullable=True)
    role = Column(String, default="staff") # "admin" or "staff"
    is_active = Column(Integer, default=1) # 1=active, 0=inactive

class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    phone = Column(String, index=True)
    email = Column(String, index=True, nullable=True)
    dob = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    appointments = relationship("Appointment", back_populates="customer")

class Service(Base):
    __tablename__ = "services"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    category = Column(String, index=True)
    sub_category = Column(String, nullable=True)
    price = Column(Numeric(10, 2))
    duration = Column(Integer) # in minutes
    is_length_based = Column(Integer, default=0) # 0=fixed, 1=length-based
    price_short = Column(Numeric(10, 2), nullable=True)
    price_medium = Column(Numeric(10, 2), nullable=True)
    price_long = Column(Numeric(10, 2), nullable=True)
    price_extra_long = Column(Numeric(10, 2), nullable=True)
    parent_id = Column(Integer, ForeignKey("services.id"), nullable=True)

    parent = relationship("Service", remote_side="Service.id", backref="sub_services")

class Package(Base):
    __tablename__ = "packages"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    price = Column(Numeric(10, 2))
    duration = Column(Integer)  # total duration in minutes
    created_at = Column(DateTime, default=datetime.utcnow)

    services = relationship("PackageService", cascade="all, delete-orphan")

class PackageService(Base):
    __tablename__ = "package_services"
    id = Column(Integer, primary_key=True, autoincrement=True)
    package_id = Column(Integer, ForeignKey("packages.id"), nullable=False)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False)

    service = relationship("Service")

class Appointment(Base):
    __tablename__ = "appointments"
    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    assigned_staff_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    date = Column(Date)
    time = Column(Time)
    status = Column(String, default="booked") # "booked", "pending", "completed", "cancelled"
    payment_status = Column(String, default="unpaid") # "unpaid", "paid", "partial"
    payment_mode = Column(String, nullable=True) # "cash", "online", None
    package_name = Column(String, nullable=True)
    paid_amount = Column(Numeric(10, 2), default=0.00)
    total_amount = Column(Numeric(10, 2), default=0.00)
    completed_at = Column(DateTime, nullable=True)

    customer = relationship("Customer", back_populates="appointments")
    assigned_staff = relationship("User", foreign_keys=[assigned_staff_id])
    services = relationship("AppointmentService", cascade="all, delete-orphan")
