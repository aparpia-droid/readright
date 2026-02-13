from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from pypdf import PdfReader
import textstat
import re
import os

app = FastAPI()

# -------------------------
# CORS Configuration
# -------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # MVP: allow all. Lock down after frontend deploy.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------
# Root + Health (Render-friendly)
# -------------------------
@app.get("/")
def root():
    return {"status": "ReadRight backend running"}

@app.get("/health")
def health():
    return {"status": "ok"}

# -------------------------
# Response Models
# -------------------------
class RiskSentence(BaseModel):
    sentence: str
    score: int

class AnalyzeResponse(BaseModel):
    grade_level: float
    reading_time_minutes: float
    top_risk_sentences: List[RiskSentence]

# -------------------------
# Text Cleanup Helpers
# -------------------------
def normalize_pdf_text(text: str) -> str:
    """
    PDFs often insert hard line breaks mid-sentence.
    This turns all whitespace into single spaces so sentence splitting works.
    """
    # Replace any whitespace (newlines, tabs) with spaces
    text = re.sub(r"\s+", " ", text)
    return text.strip()

# -------------------------
# Risk Scoring Logic
# -------------------------
def score_sentence(sentence: str) -> int:
    score = 0

    words = sentence.split()

    # Long sentence penalty
    if len(words) > 25:
        score += 2

    complex_terms = [
        "shall", "hereby", "pursuant", "liable",
        "terminate", "whereas", "thereof",
        "notwithstanding", "civil code", "hud"
    ]

    lower = sentence.lower()
    for term in complex_terms:
        if term in lower:
            score += 2

    # Numbers increase cognitive load
    if re.search(r"\d", sentence):
        score += 1

    # Conditional complexity
    if " if " in f" {lower} " or " unless " in f" {lower} ":
        score += 1

    return score

# -------------------------
# Main Analyze Endpoint
# -------------------------
@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze_pdf(file: UploadFile = File(...)):
    reader = PdfReader(file.file)

    parts = []
    for page in reader.pages:
        t = page.extract_text()
        if t:
            parts.append(t)

    full_text = "\n".join(parts)

    if not full_text.strip():
        return {
            "grade_level": 0,
            "reading_time_minutes": 0,
            "top_risk_sentences": []
        }

    # Normalize whitespace so sentences aren't chopped by PDF line breaks
    clean_text = normalize_pdf_text(full_text)

    # Readability + time
    grade_level = round(textstat.flesch_kincaid_grade(clean_text), 2)

    # textstat.reading_time returns seconds; we convert to minutes
    reading_time_minutes = round(textstat.reading_time(clean_text) / 60, 2)

    # Sentence splitting (works better after normalization)
    sentences = re.split(r'(?<=[.!?])\s+', clean_text)

    scored = []
    for s in sentences:
        s_clean = s.strip()

        # Skip tiny fragments
        if len(s_clean) < 40:
            continue

        risk = score_sentence(s_clean)
        if risk > 0:
            scored.append({"sentence": s_clean, "score": risk})

    scored = sorted(scored, key=lambda x: x["score"], reverse=True)[:5]

    return {
        "grade_level": grade_level,
        "reading_time_minutes": reading_time_minutes,
        "top_risk_sentences": scored
    }

# -------------------------
# Local Run Support
# -------------------------
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)