from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from src.api.quotes import router as quotes_router
from src.api.destinations import router as destinations_router
from src.api.services import router as services_router

app = FastAPI(title="Magalia API")

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

# CORS middleware must be added before routes
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Exception handlers to ensure CORS headers are always present
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    response = JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers={
            "Access-Control-Allow-Origin": request.headers.get("origin", "http://localhost:5173"),
            "Access-Control-Allow-Credentials": "true",
        }
    )
    return response

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    import traceback
    error_detail = traceback.format_exc()
    print(f"Unhandled exception: {exc}\n{error_detail}")
    response = JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"},
        headers={
            "Access-Control-Allow-Origin": request.headers.get("origin", "http://localhost:5173"),
            "Access-Control-Allow-Credentials": "true",
        }
    )
    return response

@app.get("/health")
def health():
    return {"ok": True, "origins": ALLOWED_ORIGINS}

app.include_router(quotes_router)
app.include_router(destinations_router)
app.include_router(services_router)

