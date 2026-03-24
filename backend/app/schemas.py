from pydantic import BaseModel, EmailStr, model_validator
from typing import Optional, List, Any
from datetime import date, time, datetime

class UserBase(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    role: str = "staff"

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None

class UserResponse(UserBase):
    id: int
    is_active: int = 1

    class Config:
        from_attributes = True

class CustomerBase(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    dob: Optional[date] = None
    notes: Optional[str] = None

class CustomerCreate(CustomerBase):
    pass

class CustomerResponse(CustomerBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class ServiceBase(BaseModel):
    name: str
    category: str
    price: float
    duration: int

class ServiceCreate(ServiceBase):
    pass

class ServiceResponse(ServiceBase):
    id: int

    class Config:
        from_attributes = True

class AppointmentBase(BaseModel):
    customer_id: int
    date: date
    time: time
    status: str = "booked"
    payment_status: str = "unpaid"
    assigned_staff_id: Optional[int] = None
    service_ids: List[int]

class AppointmentCreate(AppointmentBase):
    pass

class AppointmentServiceResponse(BaseModel):
    id: Optional[int] = None
    name: str
    price: float

    @model_validator(mode='before')
    @classmethod
    def map_fields(cls, data: Any) -> Any:
        if hasattr(data, 'appointment_id'):
            return {
                "id": data.service_id,
                "name": data.service_name or "",
                "price": float(data.price_at_booking or 0),
            }
        return data

    class Config:
        from_attributes = True

class AppointmentResponse(BaseModel):
    id: int
    customer_id: int
    date: date
    time: time
    status: str
    payment_status: str = "unpaid"
    total_amount: float
    completed_at: Optional[datetime] = None
    assigned_staff_id: Optional[int] = None
    assigned_staff: Optional[UserResponse] = None
    customer: CustomerResponse
    services: List[AppointmentServiceResponse] = []
    service_ids: List[int] = []

    @model_validator(mode='before')
    @classmethod
    def populate_service_ids(cls, data: Any) -> Any:
        if hasattr(data, 'services'):
            data.service_ids = [s.service_id for s in data.services if s.service_id is not None]
        return data

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
