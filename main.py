import os
import re
from typing import List

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pypdf import PdfReader
import textstat

from openai import OpenAI


app = FastAPI(title="ReadRight API", version="1.0.0")


# ---------------------------
# CORS
# ---------------------------
# In local dev, React is usually http://localhost:3000
# In prod, set FRONTEND_ORIGIN in Render (or wherever you host the frontend)
frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")

allowed_origins = list(
    dict.fromkeys(
        [
            "http://localhost:3000",
            "http://localhost:3001",
            frontend_origin,
        ]
    )
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------
# Models
# ---------------------------
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


class RewriteRequest(BaseModel):
    sentence: str


class RewriteResponse(BaseModel):
    rewritten: str


# ---------------------------
# Helpers
# ---------------------------
def normalize_text(text: str) -> str:
    """
    PDF extraction often includes weird newlines/spaces.
    Normalize so sentence splitting + scoring is cleaner.
    """
    if not text:
        return ""

    # Replace newlines/tabs with spaces
    text = text.replace("\n", " ").replace("\t", " ")

    # Fix common PDF hyphenation splits: "initi al" or "re- rented"
    # (This is conservative: only collapses when it looks like a split word.)
    text = re.sub(r"(\w)\s+(\w)", r"\1 \2", text)  # keep single spaces between words
    text = re.sub(r"\s*-\s*", "-", text)          # normalize spaced hyphens -> hyphen

    # Collapse multiple spaces
    text = re.sub(r"\s+", " ", text).strip()

    return text


def split_sentences(text: str) -> List[str]:
    """
    Basic sentence splitter.
    """
    if not text:
        return []
    # Split on ., !, ? followed by whitespace
    parts = re.split(r"(?<=[.!?])\s+", text)
    return [p.strip() for p in parts if p and p.strip()]


def score_sentence(sentence: str) -> int:
    score = 0

    words = sentence.split()

    # Length penalty
    if len(words) > 25:
        score += 2

    # Legal / complex language indicators
    complex_terms = [
        "shall",
        "hereby",
        "pursuant",
        "liable",
        "terminate",
        "whereas",
        "thereof",
        "notwithstanding",
        "civil code",
        "hud",
        "calhfa",
    ]

    s_lower = sentence.lower()
    for term in complex_terms:
        if term in s_lower:
            score += 2

    # Numbers increase cognitive load
    if re.search(r"\d", sentence):
        score += 1

    return score


# ---------------------------
# Routes
# ---------------------------
@app.get("/")
def root():
    return {"status": "ReadRight backend running"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze_pdf(file: UploadFile = File(...)):
    reader = PdfReader(file.file)

    raw_text = ""
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            raw_text += page_text + "\n"

    raw_text = raw_text.strip()
    if not raw_text:
        return {
            "grade_level": 0.0,
            "reading_time_minutes": 0.0,
            "total_sentences": 0,
            "average_risk_score": 0.0,
            "all_sentences": [],
            "top_risk_sentences": [],
        }

    full_text = normalize_text(raw_text)

    # Readability metrics
    grade_level = round(float(textstat.flesch_kincaid_grade(full_text)), 2)
    reading_time_minutes = round(float(textstat.reading_time(full_text, ms_per_char=14.69) / 60), 2)

    # Sentence scoring
    sentences = split_sentences(full_text)

    all_scored: List[dict] = []
    for s in sentences:
        clean = s.strip()
        if len(clean) < 20:
            continue
        risk = score_sentence(clean)
        if risk > 0:
            all_scored.append({"sentence": clean, "score": risk})

    total_sentences = len(all_scored)
    average_risk_score = round(
        (sum(x["score"] for x in all_scored) / total_sentences) if total_sentences else 0.0,
        2,
    )

    all_sorted = sorted(all_scored, key=lambda x: x["score"], reverse=True)
    top_risk = all_sorted[:10]

    return {
        "grade_level": grade_level,
        "reading_time_minutes": reading_time_minutes,
        "total_sentences": total_sentences,
        "average_risk_score": average_risk_score,
        "all_sentences": all_sorted,
        "top_risk_sentences": top_risk,
    }


@app.post("/rewrite", response_model=RewriteResponse)
async def rewrite_sentence(request: RewriteRequest):
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        # Return a clear error string the frontend can show
        # (Still uses the RewriteResponse schema by providing "rewritten".)
        return {"rewritten": "ERROR: OPENAI_API_KEY not set on the server."}

    client = OpenAI(api_key=api_key)

    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You rewrite legal/formal sentences into clear plain English without changing meaning. "
                        "Keep it concise. Do not add new obligations or omit details."
                    ),
                },
                {"role": "user", "content": request.sentence},
            ],
            temperature=0.3,
        )

        rewritten = (resp.choices[0].message.content or "").strip()
        if not rewritten:
            rewritten = "ERROR: Empty rewrite response."

        return {"rewritten": rewritten}

    except Exception as e:
        return {"rewritten": f"ERROR: {str(e)}"}