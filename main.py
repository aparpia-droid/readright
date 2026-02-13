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
# CORS
# -------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------
# Health Routes
# -------------------------
@app.get("/")
def root():
    return {"status": "ReadRight backend running"}

@app.get("/health")
def health():
    return {"status": "ok"}

# -------------------------
# Models
# -------------------------
class SentenceScore(BaseModel):
    sentence: str
    score: int

class AnalyzeResponse(BaseModel):
    grade_level: float
    reading_time_minutes: float
    total_sentences: int
    average_risk_score: float
    all_sentences: List[SentenceScore]
    top_risk_sentences: List[SentenceScore]

# -------------------------
# Helpers
# -------------------------
def normalize_pdf_text(text: str) -> str:
    text = re.sub(r"\s+", " ", text)
    return text.strip()

def score_sentence(sentence: str) -> int:
    score = 0
    words = sentence.split()

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

    if re.search(r"\d", sentence):
        score += 1

    if " if " in f" {lower} " or " unless " in f" {lower} ":
        score += 1

    return score

# -------------------------
# Main Endpoint
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
            "total_sentences": 0,
            "average_risk_score": 0,
            "all_sentences": [],
            "top_risk_sentences": []
        }

    clean_text = normalize_pdf_text(full_text)

    grade_level = round(textstat.flesch_kincaid_grade(clean_text), 2)
    reading_time_minutes = round(textstat.reading_time(clean_text) / 60, 2)

    sentences = re.split(r'(?<=[.!?])\s+', clean_text)

    all_scored = []
    total_score = 0

    for s in sentences:
        s_clean = s.strip()
        if len(s_clean) < 30:
            continue

        risk = score_sentence(s_clean)
        total_score += risk
        all_scored.append({"sentence": s_clean, "score": risk})

    total_sentences = len(all_scored)
    average_risk_score = round(total_score / total_sentences, 2) if total_sentences > 0 else 0

    top_risk_sentences = sorted(
        all_scored,
        key=lambda x: x["score"],
        reverse=True
    )[:5]

    return {
        "grade_level": grade_level,
        "reading_time_minutes": reading_time_minutes,
        "total_sentences": total_sentences,
        "average_risk_score": average_risk_score,
        "all_sentences": all_scored,
        "top_risk_sentences": top_risk_sentences
    }

# -------------------------
# Local Run
# -------------------------
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)