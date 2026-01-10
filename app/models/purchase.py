from sqlalchemy import Column, Integer, ForeignKey, Float, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Purchase(Base):
    __tablename__ = 'purchases'

    id = Column(Integer, primary_key=True, index=True)
    car_id = Column(Integer, ForeignKey('cars.id'), nullable=False)
    buyer_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    price = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    car = relationship('Car')
    buyer = relationship('User')
