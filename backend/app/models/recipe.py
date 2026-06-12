import uuid
from datetime import datetime

from sqlalchemy import String, Integer, Float, Text, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class Ingredient(Base):
    __tablename__ = "ingredients"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    category: Mapped[str] = mapped_column(String(50))
    default_unit: Mapped[str | None] = mapped_column(String(20))

    step_ingredients: Mapped[list["StepIngredient"]] = relationship(back_populates="ingredient")


class Recipe(Base):
    __tablename__ = "recipes"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    servings: Mapped[int] = mapped_column(Integer)
    cuisine: Mapped[str | None] = mapped_column(String(100))
    source: Mapped[str] = mapped_column(String(50))
    source_url: Mapped[str | None] = mapped_column(String(500))
    prep_time_mins: Mapped[int | None] = mapped_column(Integer)
    cook_time_mins: Mapped[int | None] = mapped_column(Integer)
    calories: Mapped[float | None] = mapped_column(Float)
    protein_g: Mapped[float | None] = mapped_column(Float)
    carbs_g: Mapped[float | None] = mapped_column(Float)
    fat_g: Mapped[float | None] = mapped_column(Float)
    make_ahead_type: Mapped[str] = mapped_column(String(10), default="none")
    storage_days: Mapped[int | None] = mapped_column(Integer)
    reheat_instructions: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    steps: Mapped[list["RecipeStep"]] = relationship(
        back_populates="recipe", cascade="all, delete-orphan", order_by="RecipeStep.step_number"
    )


class RecipeStep(Base):
    __tablename__ = "recipe_steps"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    recipe_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("recipes.id", ondelete="CASCADE"))
    step_number: Mapped[int] = mapped_column(Integer)
    instruction: Mapped[str] = mapped_column(Text)
    cooking_method: Mapped[str | None] = mapped_column(String(50))
    step_type: Mapped[str] = mapped_column(String(20), default="cook_fresh")
    can_cook_ahead: Mapped[bool] = mapped_column(Boolean, default=False)

    recipe: Mapped["Recipe"] = relationship(back_populates="steps")
    step_ingredients: Mapped[list["StepIngredient"]] = relationship(
        back_populates="step", cascade="all, delete-orphan"
    )


class StepIngredient(Base):
    __tablename__ = "step_ingredients"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    step_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("recipe_steps.id", ondelete="CASCADE"))
    ingredient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("ingredients.id"))
    quantity: Mapped[float | None] = mapped_column(Float)
    unit: Mapped[str | None] = mapped_column(String(30))
    prep_note: Mapped[str | None] = mapped_column(String(50))

    step: Mapped["RecipeStep"] = relationship(back_populates="step_ingredients")
    ingredient: Mapped["Ingredient"] = relationship(back_populates="step_ingredients")
