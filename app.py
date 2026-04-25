"""
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
http://localhost:8000
"""

import sys
import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

sys.path.append(str(Path(__file__).parent))
from pipeline.rag_pipeline import ask

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s  %(levelname)-8s  %(message)s")
log = logging.getLogger("app")

app = FastAPI(
    title       = "InLeagle - Indian Banking Legal AI",
    description = "RAG assistant for Indian banking law",
    version     = "1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

# ── Schemas ──────────────────────────────────────────────────

class QueryRequest(BaseModel):
    query: str = Field(..., min_length=5, max_length=1000)
    mode:  str = Field(default="auto", pattern="^(auto|layman|legal)$")
    top_k: int = Field(default=5, ge=1, le=10)

class SourceChunk(BaseModel):
    document_name: str
    source_type:   str
    year:          str | int
    score:         float

class QueryResponse(BaseModel):
    query:     str
    answer:    str
    mode:      str
    citations: list[str]
    sources:   list[SourceChunk]
    error:     str | None

# ── Routes ───────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "Indian Banking Legal AI"}


@app.post("/query", response_model=QueryResponse)
def query_endpoint(request: QueryRequest):
    log.info(f"Query [{request.mode}]: {request.query[:80]}")

    result = ask(query=request.query.strip(),
                 mode=request.mode, top_k=request.top_k)

    if result.get("error"):
        raise HTTPException(status_code=500, detail=result["error"])

    sources, seen = [], set()
    for chunk in result.get("chunks", []):
        name = chunk.get("document_name", "")
        if name and name not in seen:
            seen.add(name)
            sources.append(SourceChunk(
                document_name=name,
                source_type=chunk.get("source_type", ""),
                year=chunk.get("year", ""),
                score=chunk.get("score", 0.0),
            ))
    return QueryResponse(
        query=result["query"], answer=result["answer"],
        mode=result["mode"],   citations=result["citations"],
        sources=sources,       error=result.get("error"),
    )

@app.get("/", response_class=HTMLResponse)
def serve_frontend():
    html_path = Path(__file__).parent / "index.html"
    if not html_path.exists():
        return HTMLResponse("<h2>index.html not found in Rag/ folder</h2>")
    return HTMLResponse(html_path.read_text(encoding="utf-8"))