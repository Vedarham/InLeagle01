# Indian Banking Legal AI

RAG-powered assistant for Indian banking law built with:
- InLegal-Sbert (bhavyagiri/InLegal-Sbert) for embeddings
- Qdrant (Docker) as vector store
- Groq (llama-3.1-8b-instant) for generation
- FastAPI + vanilla HTML frontend

## Setup

1. `cp .env.example .env` and fill in GROQ_API_KEY
2. `docker-compose up -d` (starts Qdrant)
3. `pip install -r requirements.txt`
4. Place PDFs in `data/raw/acts/`, `data/raw/cases/`, `data/raw/rbi_documents/`
5. `python ingestion/ingest.py`
6. `uvicorn app:app --reload`
7. Open http://localhost:8000

## Data Sources
PDFs not included in repo — download from:
- Acts: https://indiacode.nic.in
- Cases: https://indiankanoon.org
- RBI: https://rbi.org.in
