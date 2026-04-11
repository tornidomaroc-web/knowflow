import os
import shutil
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
from markitdown import MarkItDown

app = FastAPI()

@app.post("/convert")
async def convert(file: UploadFile = File(...)):
    tmp_path = f"/tmp/{file.filename}"
    try:
        with open(tmp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        md = MarkItDown()
        result = md.convert(tmp_path)
        markdown_text = result.text_content
        
        os.remove(tmp_path)
        
        return {"markdown": markdown_text, "filename": file.filename}
    except Exception as e:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        return JSONResponse(status_code=500, content={"error": str(e)})
