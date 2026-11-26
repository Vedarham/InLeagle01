"""
InLEAGLE - Indian Banking Legal AI Backend
FastAPI server serving legal RAG, evaluation metrics, and the React frontend.
Usage:
    uvicorn app.main:app --host 0.0.0.0 --port 7860 --reload
"""

import os
import sys
import json
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# Ensure project root and app directory are in sys.path
_APP_DIR = Path(__file__).resolve().parent
_ROOT_DIR = _APP_DIR.parent
for p in [str(_APP_DIR), str(_ROOT_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from app.pipeline.rag_pipeline import ask
from app.retrieval.vectorstore import get_client
from app.evaluation.runner import run_evaluation_pipeline, REPORTS_DIR
from app.evaluation.benchmark_loader import load_benchmark, get_benchmark_stats


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-8s %(message)s")
log = logging.getLogger("inleagle_app")

app = FastAPI(
    title="InLeagle - Indian Banking Legal AI",
    description="Intelligent legal research and question answering for Indian banking law",
    version="2.0.0",
)

# ── CORS ─────────────────────────────────────────────────────
# Allows all local Vite/dev ports (3000, 5173, 8000, 7860, etc.) and remote frontends.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    max_age=86400,
)

log.info("Universal CORS enabled (allow_origins=['*'], allow_methods=['*'], allow_headers=['*'])")

_FRONTEND_DIST = _ROOT_DIR / "frontend" / "dist"

# ── Schemas ──────────────────────────────────────────────────

class Message(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str = Field(..., min_length=1)

class QueryRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=1500)
    mode: str = Field(default="auto", pattern="^(auto|layman|legal)$")
    top_k: int = Field(default=5, ge=1, le=10)
    history: List[Message] = Field(default=[])

class SourceChunk(BaseModel):
    document_name: str
    source_type: str = ""
    year: Optional[str | int] = ""
    court: Optional[str] = ""
    score: float = 0.0
    text: Optional[str] = ""

class QueryResponse(BaseModel):
    query: str
    answer: str
    mode: str
    citations: List[str]
    sources: List[SourceChunk]
    error: Optional[str] = None
    latency: Optional[Dict[str, Any]] = None

class EvaluationRunRequest(BaseModel):
    sample_limit: int = Field(default=30, ge=5, le=150)

# ── Routes: Core QA & Health ─────────────────────────────────

@app.get("/health")
def health():
    try:
        client = get_client()
        client.get_collections()
        qdrant_status = "connected"
    except Exception as e:
        log.warning(f"Qdrant health check warning: {e}")
        qdrant_status = f"offline / {str(e)}"

    return {
        "status": "ok",
        "service": "InLeagle Indian Banking Legal AI",
        "version": "2.0.0",
        "qdrant": qdrant_status,
        "frontend": "built" if _FRONTEND_DIST.is_dir() else "not-built",
    }


@app.post("/query", response_model=QueryResponse)
def query_endpoint(request: QueryRequest):
    log.info(f"Query [{request.mode}]: {request.query[:80]}")

    history_dicts = [{"role": msg.role, "content": msg.content} for msg in request.history]
    result = ask(
        query=request.query.strip(),
        mode=request.mode,
        top_k=request.top_k,
        history=history_dicts
    )

    if result.get("error") and not result.get("answer"):
        raise HTTPException(status_code=500, detail=result["error"])

    sources: List[SourceChunk] = []
    seen = set()
    for chunk in result.get("chunks", []):
        name = chunk.get("document_name", "")
        if name and name not in seen:
            seen.add(name)
            sources.append(SourceChunk(
                document_name=name,
                source_type=str(chunk.get("source_type") or "act"),
                year=chunk.get("year") or "",
                court=chunk.get("court") or "",
                score=float(chunk.get("score") or 0.0),
                text=str(chunk.get("text") or "")[:200],
            ))

    return QueryResponse(
        query=result["query"],
        answer=result["answer"],
        mode=result["mode"],
        citations=result.get("citations", []),
        sources=sources,
        error=result.get("error"),
        latency=result.get("latency"),
    )


# ── Routes: Metrics & Evaluation ──────────────────────────────

@app.get("/evaluation/summary")
def get_evaluation_summary():
    """Returns the latest consolidated benchmark metrics."""
    summary_file = REPORTS_DIR / "evaluation_summary.json"
    if summary_file.exists():
        try:
            with open(summary_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            log.error(f"Error reading summary file: {e}")

    # If no report file exists yet, generate baseline summary
    if run_evaluation_pipeline is not None:
        try:
            return run_evaluation_pipeline(sample_limit=20, output_reports=True)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to compute evaluation baseline: {e}")

    raise HTTPException(status_code=404, detail="Evaluation report not found")


@app.get("/evaluation/benchmark")
def get_benchmark_questions(
    category: Optional[str] = Query(default=None),
    mode: Optional[str] = Query(default=None),
    limit: Optional[int] = Query(default=50, ge=1, le=150),
):
    """Fetches benchmark dataset questions and metadata."""
    if load_benchmark is None:
        raise HTTPException(status_code=500, detail="Benchmark loader module unavailable")
    try:
        data = load_benchmark(category=category, query_mode=mode, limit=limit)
        stats = get_benchmark_stats() if get_benchmark_stats else {}
        return {
            "total_questions_in_dataset": stats.get("total_questions", len(data)),
            "returned_count": len(data),
            "filters": {"category": category, "mode": mode},
            "questions": data,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/evaluation/run")
def trigger_evaluation_run(request: EvaluationRunRequest):
    """Triggers an evaluation pass over the benchmark dataset."""
    if run_evaluation_pipeline is None:
        raise HTTPException(status_code=500, detail="Evaluation runner module unavailable")
    try:
        report = run_evaluation_pipeline(
            sample_limit=request.sample_limit,
            output_reports=True
        )
        return {
            "status": "success",
            "message": f"Evaluated {request.sample_limit} questions.",
            "metrics": report.get("executive_summary_metrics"),
        }
    except Exception as e:
        log.error(f"Evaluation run failed: {e}")
        raise HTTPException(status_code=500, detail=f"Evaluation execution failed: {e}")


@app.get("/evaluation/report", response_class=HTMLResponse)
def get_evaluation_html_report():
    """Serves the Markdown benchmark report rendered as HTML."""
    md_file = REPORTS_DIR / "benchmark_report.md"
    if not md_file.exists():
        if run_evaluation_pipeline is not None:
            run_evaluation_pipeline(sample_limit=20, output_reports=True)
    if md_file.exists():
        raw_md = md_file.read_text(encoding="utf-8")
        html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>InLEAGLE Evaluation & Benchmark Report</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/github-markdown-css@5.5.1/github-markdown.min.css">
    <style>
        body {{ box-sizing: border-box; min-width: 200px; max-width: 980px; margin: 0 auto; padding: 45px; background: #fdfcf9; }}
        .markdown-body {{ background: transparent; }}
    </style>
</head>
<body class="markdown-body">
    <pre style="white-space: pre-wrap; font-family: inherit;">{raw_md}</pre>
</body>
</html>"""
        return HTMLResponse(html_content)
    return HTMLResponse("<h2>Benchmark report not found</h2>")


# ── Static File Mounts & Frontend Serving ────────────────────

if _FRONTEND_DIST.is_dir():
    # Mount assets directory for styles and javascript bundles
    assets_dir = _FRONTEND_DIST / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    # Serve root icons
    @app.get("/logo.svg", include_in_schema=False)
    def serve_logo():
        logo_path = _FRONTEND_DIST / "logo.svg"
        if logo_path.exists():
            return FileResponse(logo_path, media_type="image/svg+xml")
        raise HTTPException(status_code=404)

    @app.get("/favicon.svg", include_in_schema=False)
    def serve_favicon():
        fav_path = _FRONTEND_DIST / "favicon.svg"
        if fav_path.exists():
            return FileResponse(fav_path, media_type="image/svg+xml")
        raise HTTPException(status_code=404)

    @app.get("/icons.svg", include_in_schema=False)
    def serve_icons():
        icons_path = _FRONTEND_DIST / "icons.svg"
        if icons_path.exists():
            return FileResponse(icons_path, media_type="image/svg+xml")
        raise HTTPException(status_code=404)

    # Mount /app for direct SPA route
    @app.get("/app", include_in_schema=False)
    def ui_redirect():
        return RedirectResponse(url="/app/")

    app.mount("/app", StaticFiles(directory=str(_FRONTEND_DIST), html=True), name="ui_app")

    @app.get("/", response_class=HTMLResponse)
    def serve_frontend():
        dist_index = _FRONTEND_DIST / "index.html"
        if dist_index.exists():
            return HTMLResponse(dist_index.read_text(encoding="utf-8"))
        return HTMLResponse("<h2>Frontend build not found. Run 'npm run build' in frontend/</h2>")

else:
    @app.get("/", response_class=HTMLResponse)
    def serve_fallback():
        return HTMLResponse("<h2>Frontend build not found. Run 'npm run build' in frontend/</h2>")
