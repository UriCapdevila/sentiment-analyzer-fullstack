import json
import os
import re
import urllib.error
import urllib.request
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from textblob import TextBlob

MAX_TEXT_LENGTH = 5000
DEFAULT_GEMINI_MODEL = "gemini-3.5-flash"
GEMINI_INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions"
DEFAULT_OPENAI_MODEL = "gpt-5.5"
OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"

POSITIVE_TERMS = {
    "amazing",
    "awesome",
    "best",
    "easy",
    "excellent",
    "fast",
    "great",
    "helpful",
    "intuitive",
    "love",
    "loved",
    "reliable",
    "smooth",
    "useful",
}

NEGATIVE_TERMS = {
    "annoying",
    "bad",
    "bug",
    "buggy",
    "broken",
    "confusing",
    "crash",
    "crashes",
    "difficult",
    "expensive",
    "fail",
    "failed",
    "friction",
    "hard",
    "hate",
    "issue",
    "late",
    "missing",
    "poor",
    "problem",
    "slow",
    "terrible",
    "unclear",
    "unusable",
    "wrong",
}

NEGATIVE_PHRASES = {
    "too long",
    "not working",
    "does not work",
    "doesn't work",
    "hard to use",
    "takes too long",
    "took too long",
    "waste of time",
}

CONTRAST_TERMS = {"but", "however", "although", "though", "except", "yet"}
PRODUCT_TERMS = [
    "billing",
    "checkout",
    "dashboard",
    "onboarding",
    "payment",
    "performance",
    "pricing",
    "support",
    "user interface",
]

app = FastAPI(
    title="Sentiment Analyzer AI Service",
    version="1.1.0",
)


class ReviewRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=MAX_TEXT_LENGTH)


class SentimentAnalysis(BaseModel):
    score: float = Field(..., ge=-1, le=1)
    subjectivity: float = Field(..., ge=0, le=1)
    label: Literal["Positivo", "Negativo", "Neutro", "Mixto"]
    keywords: list[str]
    confidence: float | None = Field(default=None, ge=0, le=1)
    tone: str | None = None
    severity: Literal["low", "medium", "high"] | None = None
    summary: str | None = None
    recommended_action: str | None = None
    source: Literal["local", "openai", "gemini"] = "local"


class ReviewResponse(BaseModel):
    analysis: SentimentAnalysis
    original_text: str


def load_env_file() -> None:
    env_path = Path(__file__).with_name(".env")

    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()

        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env_file()


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "sentiment-ai",
        "provider": get_provider(),
        "geminiConfigured": bool(os.getenv("GEMINI_API_KEY")),
        "openaiConfigured": bool(os.getenv("OPENAI_API_KEY")),
    }


@app.get("/")
def read_root():
    return {"status": "API de Python funcionando"}


def get_provider() -> str:
    return os.getenv("ANALYSIS_PROVIDER", "auto").strip().lower()


def split_clauses(text: str) -> list[str]:
    clauses = re.split(r"[.!?;]|\b(?:but|however|although|though|except|yet)\b", text, flags=re.IGNORECASE)
    return [clause.strip() for clause in clauses if clause.strip()]


def count_terms(text: str, terms: set[str]) -> int:
    words = re.findall(r"[a-z']+", text.lower())
    return sum(1 for word in words if word in terms)


def count_phrases(text: str, phrases: set[str]) -> int:
    lowered_text = text.lower()
    return sum(1 for phrase in phrases if phrase in lowered_text)


def has_contrast(text: str) -> bool:
    words = set(re.findall(r"[a-z']+", text.lower()))
    return bool(words.intersection(CONTRAST_TERMS))


def classify_sentiment(text: str, polarity: float) -> Literal["Positivo", "Negativo", "Neutro", "Mixto"]:
    clauses = split_clauses(text)
    clause_scores = [TextBlob(clause).sentiment.polarity for clause in clauses] or [polarity]

    positive_hits = count_terms(text, POSITIVE_TERMS)
    negative_hits = count_terms(text, NEGATIVE_TERMS) + count_phrases(text, NEGATIVE_PHRASES)
    has_positive_clause = any(score >= 0.18 for score in clause_scores)
    has_negative_clause = any(score <= -0.12 for score in clause_scores)
    mixed_signal = (
        has_contrast(text)
        and (positive_hits > 0 or has_positive_clause)
        and (negative_hits > 0 or has_negative_clause)
    )

    if mixed_signal:
        return "Mixto"

    adjusted_score = polarity + (positive_hits * 0.05) - (negative_hits * 0.08)

    if adjusted_score > 0.12:
        return "Positivo"
    if adjusted_score < -0.08:
        return "Negativo"

    return "Neutro"


def extract_keywords(blob: TextBlob, text: str) -> list[str]:
    keywords = list(blob.noun_phrases)
    lowered_text = text.lower()

    for term in PRODUCT_TERMS:
        if term in lowered_text and term not in keywords:
            keywords.append(term)

    return keywords[:8]


def analyze_with_local_engine(text: str) -> dict:
    blob = TextBlob(text)
    polarity = blob.sentiment.polarity
    subjectivity = blob.sentiment.subjectivity
    sentiment_label = classify_sentiment(text, polarity)

    return {
        "score": round(polarity, 2),
        "subjectivity": round(subjectivity, 2),
        "label": sentiment_label,
        "keywords": extract_keywords(blob, text),
        "confidence": 0.55,
        "tone": "rule-based baseline",
        "severity": "medium" if sentiment_label in {"Negativo", "Mixto"} else "low",
        "summary": "Analisis local basado en TextBlob y reglas de producto.",
        "recommended_action": "Usar proveedor LLM para mayor precision contextual.",
        "source": "local",
    }


def llm_schema() -> dict:
    return {
        "type": "object",
        "additionalProperties": False,
        "required": [
            "score",
            "subjectivity",
            "label",
            "keywords",
            "confidence",
            "tone",
            "severity",
            "summary",
            "recommended_action",
        ],
        "properties": {
            "score": {"type": "number", "minimum": -1, "maximum": 1},
            "subjectivity": {"type": "number", "minimum": 0, "maximum": 1},
            "label": {"type": "string", "enum": ["Positivo", "Negativo", "Neutro", "Mixto"]},
            "keywords": {
                "type": "array",
                "minItems": 0,
                "maxItems": 8,
                "items": {"type": "string"},
            },
            "confidence": {"type": "number", "minimum": 0, "maximum": 1},
            "tone": {"type": "string"},
            "severity": {"type": "string", "enum": ["low", "medium", "high"]},
            "summary": {"type": "string"},
            "recommended_action": {"type": "string"},
        },
    }


LLM_SYSTEM_INSTRUCTION = (
    "You are a customer-feedback intelligence engine for a SaaS product. "
    "Classify the user feedback with product judgment, not generic positivity. "
    "Negative operational friction, churn risk, billing issues, support delays, bugs, confusion, "
    "pricing complaints, and reliability problems should be weighted strongly. "
    "Use Mixto when feedback contains both clear praise and clear friction. "
    "Return concise Spanish business-facing fields."
)


def normalize_llm_analysis(analysis: dict, source: Literal["openai", "gemini"]) -> dict:
    analysis["score"] = round(float(analysis["score"]), 2)
    analysis["subjectivity"] = round(float(analysis["subjectivity"]), 2)
    analysis["confidence"] = round(float(analysis["confidence"]), 2)
    analysis["keywords"] = [str(keyword) for keyword in analysis.get("keywords", [])][:8]
    analysis["source"] = source

    return analysis


def build_openai_payload(text: str) -> dict:
    model = os.getenv("OPENAI_MODEL", DEFAULT_OPENAI_MODEL).strip() or DEFAULT_OPENAI_MODEL

    return {
        "model": model,
        "input": [
            {
                "role": "developer",
                "content": LLM_SYSTEM_INSTRUCTION,
            },
            {
                "role": "user",
                "content": f"Analyze this customer feedback:\n{text}",
            },
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "sentiment_analysis",
                "strict": True,
                "schema": llm_schema(),
            }
        },
    }


def build_gemini_payload(text: str) -> dict:
    model = os.getenv("GEMINI_MODEL", DEFAULT_GEMINI_MODEL).strip() or DEFAULT_GEMINI_MODEL

    return {
        "model": model,
        "store": False,
        "system_instruction": LLM_SYSTEM_INSTRUCTION,
        "input": f"Analyze this customer feedback:\n{text}",
        "generation_config": {
            "temperature": 0.1,
            "thinking_level": "low",
        },
        "response_format": {
            "type": "text",
            "mime_type": "application/json",
            "schema": llm_schema(),
        },
    }


def post_json(url: str, payload: dict, headers: dict, timeout: int) -> dict:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={"Content-Type": "application/json", **headers},
    )

    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def extract_openai_response_text(response_data: dict) -> str:
    if response_data.get("output_text"):
        return response_data["output_text"]

    for output_item in response_data.get("output", []):
        for content_item in output_item.get("content", []):
            if "text" in content_item:
                return content_item["text"]

    raise ValueError("OpenAI response did not include output text")


def extract_gemini_response_text(response_data: dict) -> str:
    if response_data.get("output_text"):
        return response_data["output_text"]

    if response_data.get("outputText"):
        return response_data["outputText"]

    for step in reversed(response_data.get("steps", [])):
        content = step.get("content", [])

        if isinstance(content, str):
            return content

        for content_item in content:
            if isinstance(content_item, dict) and content_item.get("text"):
                return content_item["text"]

    raise ValueError("Gemini response did not include output text")


def analyze_with_openai(text: str) -> dict:
    api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")

    timeout = int(os.getenv("LLM_TIMEOUT_SECONDS", "25"))
    response_data = post_json(
        OPENAI_RESPONSES_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
        },
        payload=build_openai_payload(text),
        timeout=timeout,
    )

    return normalize_llm_analysis(json.loads(extract_openai_response_text(response_data)), "openai")


def analyze_with_gemini(text: str) -> dict:
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    timeout = int(os.getenv("LLM_TIMEOUT_SECONDS", "25"))
    response_data = post_json(
        GEMINI_INTERACTIONS_URL,
        headers={
            "x-goog-api-key": api_key,
        },
        payload=build_gemini_payload(text),
        timeout=timeout,
    )

    return normalize_llm_analysis(json.loads(extract_gemini_response_text(response_data)), "gemini")


def analyze_with_configured_llm(text: str) -> dict:
    if os.getenv("GEMINI_API_KEY"):
        return analyze_with_gemini(text)

    return analyze_with_openai(text)


def analyze_feedback(text: str) -> dict:
    provider = get_provider()

    if provider == "local":
        return analyze_with_local_engine(text)

    if provider == "gemini":
        try:
            return analyze_with_gemini(text)
        except (
            RuntimeError,
            TimeoutError,
            ValueError,
            urllib.error.URLError,
            urllib.error.HTTPError,
            json.JSONDecodeError,
        ) as error:
            raise HTTPException(status_code=502, detail=f"Proveedor Gemini no disponible: {error}") from error

    if provider == "openai":
        try:
            return analyze_with_openai(text)
        except (
            RuntimeError,
            TimeoutError,
            ValueError,
            urllib.error.URLError,
            urllib.error.HTTPError,
            json.JSONDecodeError,
        ) as error:
            raise HTTPException(status_code=502, detail=f"Proveedor OpenAI no disponible: {error}") from error

    if provider == "auto":
        try:
            return analyze_with_configured_llm(text)
        except (
            RuntimeError,
            TimeoutError,
            ValueError,
            urllib.error.URLError,
            urllib.error.HTTPError,
            json.JSONDecodeError,
        ):
            return analyze_with_local_engine(text)

    raise HTTPException(status_code=500, detail=f"Proveedor de analisis no soportado: {provider}")


@app.post("/analyze", response_model=ReviewResponse)
def analyze_sentiment(request: ReviewRequest):
    text = request.text.strip()

    if not text:
        raise HTTPException(status_code=422, detail="El texto es obligatorio")

    return {
        "analysis": analyze_feedback(text),
        "original_text": text,
    }
