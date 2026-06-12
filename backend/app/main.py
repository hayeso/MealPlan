from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import import_routes, recipes, meal_plans, grocery, prep, today

app = FastAPI(title="MealPlan API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(import_routes.router)
app.include_router(recipes.router)
app.include_router(meal_plans.router)
app.include_router(grocery.router)
app.include_router(prep.router)
app.include_router(today.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
