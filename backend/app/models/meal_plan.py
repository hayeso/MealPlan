import uuid
from datetime import date, datetime

from sqlalchemy import String, Integer, Boolean, Date, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class MealPlan(Base):
    __tablename__ = "meal_plans"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    week_start: Mapped[date] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    slots: Mapped[list["MealPlanSlot"]] = relationship(
        back_populates="meal_plan", cascade="all, delete-orphan"
    )


class MealPlanSlot(Base):
    __tablename__ = "meal_plan_slots"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    meal_plan_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("meal_plans.id", ondelete="CASCADE"))
    day_of_week: Mapped[int] = mapped_column(Integer)
    meal_type: Mapped[str] = mapped_column(String(20), default="dinner")
    recipe_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("recipes.id"))
    servings_override: Mapped[int | None] = mapped_column(Integer)
    is_anchor: Mapped[bool] = mapped_column(Boolean, default=False)

    meal_plan: Mapped["MealPlan"] = relationship(back_populates="slots")
    recipe: Mapped["Recipe"] = relationship()  # noqa: F821 — resolved at runtime
