from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .auth import get_current_user
from .config import settings
from .routers import auth, import_routes, recipes, meal_plans, grocery, prep, today

app = FastAPI(title="MealPlan API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

protected = [Depends(get_current_user)]

app.include_router(auth.router)
app.include_router(import_routes.router, dependencies=protected)
app.include_router(recipes.router, dependencies=protected)
app.include_router(meal_plans.router, dependencies=protected)
app.include_router(grocery.router, dependencies=protected)
app.include_router(prep.router, dependencies=protected)
app.include_router(today.router, dependencies=protected)

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


@app.get("/health")
async def health():
    return {"status": "ok"}


if settings.serve_static and STATIC_DIR.exists():
    assets_dir = STATIC_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = STATIC_DIR / full_path
        if full_path and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(STATIC_DIR / "index.html")
