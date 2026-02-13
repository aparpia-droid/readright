import os
import re
from typing import List

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pypdf import PdfReader
import textstat

app = FastAPI()

# ----------------------------
# CORS
# ----------------------------
# Local dev origin + optional deployed frontend origin
FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN")  # e.g. https://your-frontend.vercel.app

allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

if FRONTEND_ORIGIN:
    allowed_origins.append(FRONTEND_ORIGIN)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,  # keep False unless you truly need cookies/auth
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------
# Models
# ----------------------------
class RiskSentence(BaseModel):
    sentence: str
    score: int

class AnalyzeResponse(BaseModel):
    grade_level: float
    reading_time_minutes: float
    top_risk_sentences: List[RiskSentence]

# ----------------------------
# Helpers
# ----------------------------
def score_sentence(sentence: str) -> int:
    score = 0

    # Length penalty
    if len(sentence.split()) > 25:
        score += 2

    complex_terms = [
        "shall", "hereby", "pursuant", "liable",
        "terminate", "whereas", "thereof",
        "notwithstanding", "civil code", "hud",
    ]

    lower = sentence.lower()
    for term in complex_terms:
        if term in lower:
            score += 2

    # Numbers increase cognitive load
    if re.search(r"\d", sentence):
        score += 1

    return score

def estimate_reading_time_minutes(text: str, wpm: int = 200) -> float:
    words = len(re.findall(r"\w+", text))
    if words == 0:
        return 0.0
    return round(words / wpm, 2)

# ----------------------------
# Routes
# ----------------------------
@app.get("/health")
def health():
    return {"ok": True}

@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze_pdf(file: UploadFile = File(...)):
    reader = PdfReader(file.file)

    full_text_parts = []
    for page in reader.pages:
        t = page.extract_text()
        if t:
            full_text_parts.append(t)

    full_text = "\n".join(full_text_parts).strip()

    if not full_text:
        return {
            "grade_level": 0.0,
            "reading_time_minutes": 0.0,
            "top_risk_sentences": [],
        }

    grade_level = round(textstat.flesch_kincaid_grade(full_text), 2)
    reading_time = estimate_reading_time_minutes(full_text)

    sentences = re.split(r'(?<=[.!?])\s+', full_text)
    scored = []

    for s in sentences:
        clean = s.strip()
        if len(clean) > 40:
            risk = score_sentence(clean)
            if risk > 0:
                scored.append({"sentence": clean, "score": risk})

    scored = sorted(scored, key=lambda x: x["score"], reverse=True)[:5]

    return {
        "grade_level": grade_level,
        "reading_time_minutes": reading_time,
        "top_risk_sentences": scored,
    }

# ----------------------------
# Local run (optional)
# ----------------------------
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)