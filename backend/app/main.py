from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.api.routes import router as api_router
from app.db.database import engine
from app.db.models import Base
import os

limiter = Limiter(key_func=get_remote_address)

def create_app() -> FastAPI:
    app = FastAPI(
        title="Career-AI API",
        description="Backend for Career-AI Resume Intelligence Platform.",
        version="1.0.0"
    )

    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    allowed_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix="/api/v1")

    @app.get("/health")
    def health_check():
        return {"status": "healthy"}

    Base.metadata.create_all(bind=engine)

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
