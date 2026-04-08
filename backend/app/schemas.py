from pydantic import BaseModel, EmailStr, model_validator, field_serializer
from typing import Optional, List, Any, Union
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
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ServiceBase(BaseModel):
    name: str
    category: str
    sub_category: Optional[str] = None
    price: float
    duration: int
    is_length_based: int = 0
    price_short: Optional[float] = None
    price_medium: Optional[float] = None
    price_long: Optional[float] = None
    price_extra_long: Optional[float] = None
    parent_id: Optional[int] = None

    @model_validator(mode='before')
    @classmethod
    def convert_decimal(cls, data: Any) -> Any:
        if hasattr(data, 'price') and data.price is not None:
            data.price = float(data.price)
        for f in ('price_short', 'price_medium', 'price_long', 'price_extra_long'):
            if hasattr(data, f) and getattr(data, f) is not None:
                setattr(data, f, float(getattr(data, f)))
        return data

class ServiceCreate(ServiceBase):
    pass

class SubServiceResponse(BaseModel):
    id: int
    name: str
    category: str
    sub_category: Optional[str] = None
    price: float
    duration: int
    is_length_based: int = 0
    price_short: Optional[float] = None
    price_medium: Optional[float] = None
    price_long: Optional[float] = None
    price_extra_long: Optional[float] = None
    parent_id: Optional[int] = None

    @model_validator(mode='before')
    @classmethod
    def convert_decimal(cls, data: Any) -> Any:
        if hasattr(data, 'price') and data.price is not None:
            data.price = float(data.price)
        for f in ('price_short', 'price_medium', 'price_long', 'price_extra_long'):
            if hasattr(data, f) and getattr(data, f) is not None:
                setattr(data, f, float(getattr(data, f)))
        return data

    class Config:
        from_attributes = True

    def model_post_init(self, __context: Any) -> None:
        self.model_fields_set.update(self.model_fields.keys())

class ServiceResponse(ServiceBase):
    id: int
    sub_services: List[SubServiceResponse] = []

    class Config:
        from_attributes = True

    def model_post_init(self, __context: Any) -> None:
        """Ensure all fields are marked as set so FastAPI includes them in response."""
        self.model_fields_set.update(self.model_fields.keys())

class PackageServiceResponse(BaseModel):
    id: int
    name: str
    category: str
    sub_category: Optional[str] = None
    price: float
    duration: int

    class Config:
        from_attributes = True

class PackageBase(BaseModel):
    name: str
    price: float
    duration: int
    service_ids: List[int]

class PackageCreate(PackageBase):
    pass

class PackageResponse(BaseModel):
    id: int
    name: str
    price: float
    duration: int
    created_at: Optional[datetime] = None
    services: List[PackageServiceResponse] = []

    @model_validator(mode='before')
    @classmethod
    def convert_fields(cls, data: Any) -> Any:
        if hasattr(data, 'price') and data.price is not None:
            data.price = float(data.price)
        return data

    class Config:
        from_attributes = True

    def model_post_init(self, __context: Any) -> None:
        self.model_fields_set.update(self.model_fields.keys())

class AppointmentBase(BaseModel):
    customer_id: int
    date: date
    time: time
    status: str = "booked"
    payment_status: str = "unpaid"
    payment_mode: Optional[str] = None
    paid_amount: Optional[float] = 0.0
    assigned_staff_id: Optional[int] = None
    service_ids: List[int]
    service_prices: Optional[dict] = None  # {service_id: price} for length-based overrides
    total_amount_override: Optional[float] = None
    package_name: Optional[str] = None

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
    time: Union[time, str]
    status: str
    payment_status: str = "unpaid"
    payment_mode: Optional[str] = None
    package_name: Optional[str] = None
    paid_amount: float = 0.0
    total_amount: float = 0.0
    completed_at: Optional[datetime] = None
    assigned_staff_id: Optional[int] = None
    assigned_staff: Optional[UserResponse] = None
    customer: CustomerResponse
    services: List[AppointmentServiceResponse] = []
    service_ids: List[int] = []

    @field_serializer('time')
    def serialize_time(self, value: Any) -> str:
        if isinstance(value, time):
            return value.strftime('%H:%M')
        return str(value)

    @model_validator(mode='before')
    @classmethod
    def populate_service_ids(cls, data: Any) -> Any:
        if hasattr(data, 'services'):
            data.service_ids = [s.service_id for s in data.services if s.service_id is not None]
        # Convert Decimal to float for PostgreSQL compatibility
        if hasattr(data, 'paid_amount') and data.paid_amount is not None:
            data.paid_amount = float(data.paid_amount)
        if hasattr(data, 'total_amount') and data.total_amount is not None:
            data.total_amount = float(data.total_amount)
        return data

    class Config:
        from_attributes = True

    def model_post_init(self, __context: Any) -> None:
        """Ensure all fields are included in API response (not stripped by FastAPI)."""
        self.model_fields_set.update(self.model_fields.keys())

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
