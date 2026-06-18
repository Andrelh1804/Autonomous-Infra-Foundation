import os
import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("BACKEND_PORT", 8000))
    uvicorn.run(
        "backend.api.v1.app:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info",
    )
