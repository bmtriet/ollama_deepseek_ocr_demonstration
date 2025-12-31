from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
import base64
import re
from PIL import Image, ImageDraw
import io
import uvicorn
import json

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_API_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "deepseek-ocr"

def draw_bounding_boxes(image_bytes: bytes, response_text: str) -> str:
    """Parses coordinates from response_text and draws them on the image."""
    try:
        img = Image.open(io.BytesIO(image_bytes))
        draw = ImageDraw.Draw(img)
        w, h = img.size
        
        # Regex to match [[y1, x1, y2, x2]]
        coords_pattern = r'\[\[(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\]\]'
        matches = re.findall(coords_pattern, response_text)
        
        for match in matches:
            x1, y1, x2, y2 = map(int, match)
            # Scale coordinates (DeepSeek uses 0-1000)
            left = x1 * w / 1000
            top = y1 * h / 1000
            right = x2 * w / 1000
            bottom = y2 * h / 1000
            
            # Draw box with bright green outline
            draw.rectangle([left, top, right, bottom], outline="#00ff00", width=3)
        
        # Save to buffer
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        return base64.b64encode(buffered.getvalue()).decode('utf-8')
    except Exception as e:
        print(f"Error drawing boxes: {e}")
        return None

@app.get("/")
async def root():
    return {"message": "DeepSeek OCR Backend is running"}

@app.post("/ocr")
async def perform_ocr(
    file: UploadFile = File(...),
    prompt: str = Form(...)
):
    try:
        # Read image
        image_data = await file.read()
        
        # Encode to Base64 for Ollama
        base64_image = base64.b64encode(image_data).decode('utf-8')
        
        # Prepare Ollama request
        payload = {
            "model": MODEL_NAME,
            "prompt": prompt,
            "images": [base64_image],
            "stream": True
        }
        
        print(f"--- Sending request to Ollama ({MODEL_NAME}) ---", flush=True)
        
        text_response = ""
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", OLLAMA_API_URL, json=payload) as response:
                response.raise_for_status()
                
                async for chunk in response.aiter_bytes():
                    if chunk:
                        try:
                            # Parse JSON chunk
                            chunk_data = json.loads(chunk.decode('utf-8'))
                            content = chunk_data.get("response", "")
                            
                            # Log content to console
                            print(content, end="", flush=True)
                            
                            # Accumulate text
                            text_response += content
                            
                            if chunk_data.get("done"):
                                print("\n--- Generation Complete ---", flush=True)
                        except json.JSONDecodeError:
                            continue
            
            # Draw boxes on the image (Backend Visualization)
            processed_image_base64 = draw_bounding_boxes(image_data, text_response)
            
            return {
                "text": text_response,
                "processed_image": processed_image_base64,
                "done": True
            }
            
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Ollama API Error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
