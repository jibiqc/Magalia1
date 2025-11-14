import logging
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

# Import all models first to ensure SQLAlchemy metadata is properly initialized
from src.models.db import Base, engine
from src.models_quote import Quote, QuoteDay, QuoteLine
from src.models_geo import Destination, DestinationPhoto
from src.models.prod_models import ServiceCatalog, ServicePopularity, Supplier, ServiceImage
from src.models.auth_models import User, LoginToken

# Import routers after models
from src.api.quotes import router as quotes_router
from src.api.destinations import router as destinations_router
from src.api.services import router as services_router
from src.api.auth import router as auth_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Magalia API")

# Allow all origins in development (for debugging CORS issues)
# In production, restrict to specific domains
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

# CORS middleware must be added before routes
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1|\[::1\]):5173",  # Allow localhost variants for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

def make_cors_response(request: Request, status_code: int, content: dict):
    """Helper function to create JSONResponse with CORS headers."""
    return JSONResponse(
        status_code=status_code,
        content=content,
        headers={
            "Access-Control-Allow-Origin": request.headers.get("origin", "http://localhost:5173"),
            "Access-Control-Allow-Credentials": "true",
        }
    )

# Exception handlers to ensure CORS headers are always present
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle Pydantic validation errors (422) with CORS headers."""
    logger.warning(f"Validation error: {exc.errors()}")
    return make_cors_response(
        request,
        422,
        {"detail": exc.errors(), "body": exc.body}
    )

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return make_cors_response(
        request,
        exc.status_code,
        {"detail": exc.detail}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    import traceback
    error_detail = traceback.format_exc()
    logger.error(f"Unhandled exception: {exc}\n{error_detail}")
    return make_cors_response(
        request,
        500,
        {"detail": f"Internal server error: {str(exc)}"}
    )

@app.get("/health")
def health():
    return {"ok": True, "origins": ALLOWED_ORIGINS}

app.include_router(quotes_router)
app.include_router(destinations_router)
app.include_router(services_router)
app.include_router(auth_router)




