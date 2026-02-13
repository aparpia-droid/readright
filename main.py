from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from pypdf import PdfReader
import textstat
import re
import os

app = FastAPI()

# ---------------------------
# CORS
# ---------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # safe for now; lock down later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------
# Health + Root Endpoints
# ---------------------------
@app.get("/")
def root():
    return {"status": "ReadRight backend running"}

@app.get("/health")
def health():
    return {"ok": True}

# ---------------------------
# Response Models
# ---------------------------
class RiskSentence(BaseModel):
    sentence: str
    score: int

class AnalyzeResponse(BaseModel):
    grade_level: float
    reading_time_minutes: float
    top_risk_sentences: List[RiskSentence]

# ---------------------------
# Risk Scoring Logic
# ---------------------------
def score_sentence(sentence: str) -> int:
    score = 0

    # Length penalty
    if len(sentence.split()) > 25:
        score += 2

    # Legal / complex language indicators
    complex_terms = [
        "shall", "hereby", "pursuant", "liable",
        "terminate", "whereas", "thereof",
        "notwithstanding", "civil code", "hud"
    ]

    for term in complex_terms:
        if term.lower() in sentence.lower():
            score += 2

    # Numbers increase cognitive load
    if re.search(r"\d", sentence):
        score += 1

    return score

# ---------------------------
# Main Analyze Endpoint
# ---------------------------
@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze_pdf(file: UploadFile = File(...)):
    reader = PdfReader(file.file)

    full_text = ""
    for page in reader.pages:
        text = page.extract_text()
        if text:
            full_text += text + "\n"

    if not full_text.strip():
        return AnalyzeResponse(
            grade_level=0,
            reading_time_minutes=0,
            top_risk_sentences=[]
        )

    grade_level = round(textstat.flesch_kincaid_grade(full_text), 2)
    reading_time = round(
        textstat.reading_time(full_text, ms_per_char=14.69) / 60,
        2
    )

    sentences = re.split(r'(?<=[.!?])\s+', full_text)
    scored = []

    for s in sentences:
        clean = s.strip()
        if len(clean) > 40:
            risk = score_sentence(clean)
            if risk > 0:
                scored.append(
                    RiskSentence(sentence=clean, score=risk)
                )

    scored = sorted(scored, key=lambda x: x.score, reverse=True)[:5]

    return AnalyzeResponse(
        grade_level=grade_level,
        reading_time_minutes=reading_time,
        top_risk_sentences=scored
    )

# ---------------------------
# Local Run (for development)
# ---------------------------
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)