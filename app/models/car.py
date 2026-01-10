from sqlalchemy import Column, Integer, String, Float, ForeignKey, Boolean
from app.database import Base
from sqlalchemy.orm import relationship

class Car(Base):
    __tablename__ = "cars"
    id = Column(Integer, primary_key=True, index=True)
    brand = Column(String)
    model = Column(String)
    year = Column(Integer)
    price = Column(Float)
    image_url = Column(String)
    owner_id = Column(Integer, ForeignKey("users.id"))
    is_sold = Column(Boolean, default=False)
    creator = relationship("User", back_populates="cars")