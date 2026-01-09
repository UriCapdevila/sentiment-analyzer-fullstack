from fastapi import FastAPI
from pydantic import BaseModel
from textblob import TextBlob

app = FastAPI()

class ReviewRequest(BaseModel):
    text: str
    
@app.get("/")
def read_root():
    return {"status": "API de Python funcionando 🚀"}

@app.post("/analyze")
def analyze_sentiment(request: ReviewRequest):
    blob = TextBlob(request.text)
    
    # Análisis básico
    polarity = blob.sentiment.polarity
    subjectivity = blob.sentiment.subjectivity
    
    # Extraer palabras clave (sustantivos)
    keywords = blob.noun_phrases 

    if polarity > 0.1: sentiment_label = "Positivo"
    elif polarity < -0.1: sentiment_label = "Negativo"
    else: sentiment_label = "Neutro"

    return {
        "analysis": {
            "score": round(polarity, 2),
            "subjectivity": round(subjectivity, 2),
            "label": sentiment_label,
            "keywords": keywords 
        },
        "original_text": request.text
    }