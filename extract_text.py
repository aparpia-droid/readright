from pypdf import PdfReader
import re
import textstat

def extract_text_from_pdf(path: str) -> str:
    reader = PdfReader(path)
    text_parts = []
    for page in reader.pages:
        page_text = page.extract_text() or ""
        text_parts.append(page_text)
    text = "\n".join(t.strip() for t in text_parts if t.strip())
    return text

def assert_text_pdf(text: str, min_chars: int = 500):
    if len(text) < min_chars:
        raise ValueError("OCR not supported in demo version. Please upload a text-based PDF.")

def compute_readability(text: str):
    grade = textstat.flesch_kincaid_grade(text)
    reading_time = textstat.reading_time(text)
    return grade, reading_time

def split_sentences(text: str):
    return re.split(r'(?<=[.!?]) +', text)

def risk_score(sentence: str):
    score = 0
    
    # Long sentence penalty
    if len(sentence.split()) > 25:
        score += 2

    # Legal/medical jargon detection
    jargon_terms = ["shall", "liable", "indemnify", "waive", "penalty",
                    "terminate", "nonrefundable", "dosage", "administer",
                    "contraindicated", "adverse", "required"]

    for term in jargon_terms:
        if term in sentence.lower():
            score += 1

    # Conditional complexity
    if "if" in sentence.lower() or "unless" in sentence.lower():
        score += 1

    return score

if __name__ == "__main__":
    import sys
    pdf_path = sys.argv[1]
    
    text = extract_text_from_pdf(pdf_path)
    assert_text_pdf(text)

    grade, reading_time = compute_readability(text)

    sentences = split_sentences(text)
    scored = [(s, risk_score(s)) for s in sentences]
    scored.sort(key=lambda x: x[1], reverse=True)

    print("\nReadability Grade Level:", round(grade, 2))
    print("Estimated Reading Time (minutes):", round(reading_time / 60, 2))

    print("\nTop 5 High-Risk Sentences:\n")
    for s, score in scored[:5]:
        print("Risk Score:", score)
        print(s.strip())
        print("-----")