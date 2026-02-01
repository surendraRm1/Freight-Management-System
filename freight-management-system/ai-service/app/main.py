import os
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel


app = FastAPI(
    title="Freight AI Service",
    version="0.1.0",
    description="Placeholder API for intent analysis. Replace with real models."
)

SERVICE_TOKEN = os.getenv("AI_SERVICE_API_KEY")


class IntentRequest(BaseModel):
    text: str


@app.get("/")
async def root():
    return {"status": "AI Service is running"}


@app.post("/analyze-intent")
async def analyze_intent(payload: IntentRequest, x_ai_key: str = Header(None)):
    if SERVICE_TOKEN and x_ai_key != SERVICE_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid AI service token")

    text = payload.text.strip()

    if not text:
        raise HTTPException(status_code=400, detail="Text prompt is required")

    # Stubbed intent detection — replace with actual NLP pipeline.
    mock_intent = "general_inquiry" if len(text.split()) < 5 else "shipment_update"

    return {
        "intent": mock_intent,
        "confidence": 0.42,
        "message": "Mock intent result. Plug in model or API when available.",
        "echo": text
    }
