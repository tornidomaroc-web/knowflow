import os
import shutil
import tempfile
from fastapi import FastAPI, UploadFile, File, Header, HTTPException
from fastapi.responses import JSONResponse
from markitdown import MarkItDown

app = FastAPI()

INGESTION_TOKEN = os.environ.get("INGESTION_TOKEN")


def _check_auth(authorization: str | None) -> None:
    if not INGESTION_TOKEN:
        raise HTTPException(status_code=503, detail="Service not configured")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    if authorization.removeprefix("Bearer ").strip() != INGESTION_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid token")


@app.get("/health")
async def health():
    return {"ok": True}


@app.post("/convert")
async def convert(
    file: UploadFile = File(...),
    authorization: str | None = Header(default=None),
):
    _check_auth(authorization)

    fd, tmp_path = tempfile.mkstemp(suffix=f"_{file.filename or 'upload'}")
    os.close(fd)
    try:
        with open(tmp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        md = MarkItDown()
        result = md.convert(tmp_path)
        markdown_text = result.text_content

        return {"markdown": markdown_text, "filename": file.filename}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
    finally:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass
