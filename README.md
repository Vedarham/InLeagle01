---
title: InLeagle Indian Banking Legal AI
emoji: ⚖️
colorFrom: yellow
colorTo: gray
sdk: docker
pinned: false
app_port: 7860
---

# InLeagle: Intelligent Legal Research & Question Answering System for Indian Judiciary

[![Hugging Face Space](https://img.shields.io/badge/%F0%9F%A4%97%20Hugging%20Face-Space-yellow)](https://huggingface.co/spaces)
[![Python 3.11](https://img.shields.io/badge/Python-3.11-blue.svg)](https://www.python.org/)
[![Qdrant](https://img.shields.io/badge/Vector%20DB-Qdrant-red.svg)](https://qdrant.tech/)
[![Groq](https://img.shields.io/badge/LLM%20Inference-Groq-orange.svg)](https://groq.com/)
[![FastAPI](https://img.shields.io/badge/Framework-FastAPI-green.svg)](https://fastapi.tiangolo.com/)

---

## Brief Description

**InLEAGLE** (Intelligent Legal Research & QA System for Indian Judiciary) is an AI-powered legal assistant specialized in Indian banking laws, financial statutes, and central regulations. The system addresses a critical gap in the financial sector where navigating complex banking disputes, loan recovery procedures, and regulatory compliances is highly difficult for individual borrowers, students, and smaller legal practitioners.

By utilizing Retrieval-Augmented Generation (RAG) and semantic search powered by **bhavyagiri/InLegal-Sbert** (fine-tuned on the Indian Legal Corpus), InLEAGLE understands the semantic meaning of natural language queries (such as queries regarding loan recovery, cheque bouncing, and CIBIL disputes) rather than relying solely on keyword matching. The system indexes key statutory acts (e.g., SARFAESI Act, NI Act Section 138, Banking Regulation Act, IBC), central regulatory guidelines (RBI Master Directions on KYC, Fair Practices Code, and Frauds), and landmark banking precedents (such as *Mardia Chemicals*, *Transcore*, *Lalit Kumar Jain*, and *ICICI vs. Shanti Devi*), grounding LLM responses in verifiable citations to prevent hallucinations.

---

## Performance Benchmarks & Legal Evaluation

InLEAGLE establishes a formal, reproducible **150-question benchmark dataset** (`app/evaluation/data/benchmark_150.json`) with ground-truth expected answers, verified statutory sections, landmark precedents, exact financial figures, and jurisdiction rules across 10 core banking law domains.

### Executive Evaluation Baseline (150-Question Benchmark)

| Evaluation Metric | Measured Baseline | Target Benchmark | Formal Definition |
|---|---|---|---|
| **RAGAS Faithfulness** | **95.0%** | $\ge 85.0\%$ | Fraction of generated answer claims directly grounded in retrieved context |
| **Retrieval Recall@5** | **63.2%** | $\ge 60.0\%$ | Fraction of distinct ground truth statutes/precedents captured in top-5 chunks |
| **Retrieval Precision@5** | **69.3%** | $\ge 65.0\%$ | Fraction of top-5 retrieved chunks that match ground truth authorities |
| **Retrieval MRR** | **0.8333** | $\ge 0.7000$ | Mean Reciprocal Rank of the first relevant legal document |
| **Retrieval Latency (P50)** | **341.3 ms** | $< 1000$ ms | Median semantic search latency over Qdrant cloud vector store |
| **Jurisdiction Accuracy** | **86.7%** | $\ge 75.0\%$ | Whether the competent forum and statutory bar (§34 SARFAESI, DRT, NCLT) are identified |
| **Citation Precision** | **100.0%** | $\ge 90.0\%$ | Percentage of cited sources that genuinely support their associated claims |
| **Citation Coverage** | **57.4%** | $\ge 50.0\%$ | Percentage of material factual/legal claims supported by verifiable citations |
| **Statutory Accuracy** | **75.0%** | $\ge 70.0\%$ | Whether the cited section, subsection, and Act are exact and legally correct |
| **Temporal Validity** | **92.3%** | $\ge 85.0\%$ | Whether the provision or circular cited was in force on the operative date |
| **Contradiction Detection** | **48.0%** | $\ge 40.0\%$ | Whether conflicting legal authorities (e.g. IBC §238 overriding SARFAESI) are flagged |
| **RAGAS Answer Relevance** | **80.9%** | $\ge 80.0\%$ | Semantic completeness and alignment with user question intent |
| **Financial Math Pass Rate**| **100.0%** | $100.0\%$ | Exact mathematical pass rate on EMI, NI Act §143A/148 caps, and DRAT pre-deposits |

---

## Tech Stack & Tools Used

### Active & Implemented Features
* **Legal Embeddings**: `bhavyagiri/InLegal-Sbert` (768-dimensional semantic vectors trained on 27GB of Indian legal text by IIT Kharagpur/OpenNyAI)
* **Vector Database**: `Qdrant` (Persistent cloud vector store, approximate nearest neighbor search via HNSW, cosine distance metric)
* **Language Model (LLM)**: Dynamic active model discovery via Groq API — at startup the pipeline queries `/openai/models` to enumerate available Groq-hosted models and ranks them (prioritising high-quota models such as `qwen/qwen3.8-27b` and `openai/gpt-oss-20b`, deprioritising heavy free-tier-limited models). Decommissioned models (`llama-3.3-70b-versatile`, `mixtral-8x7b-32768`, `gemma2-9b-it`) are automatically excluded. 429 rate-limit responses trigger a 1-second back-off and automatic fallback to the next ranked model — no manual model pinning required.
* **Orchestration**: `LangChain` (Manages prompt building and LLM-context interaction)
* **PDF Extraction**: `pdfplumber` (Native PDF parsing with structural retention testing)
* **Backend Framework**: `FastAPI` (Python REST API for serving model predictions and evaluation suites)
* **Frontend**: React 19 + Tailwind CSS — warm paper and deep teal editorial interface, Overview dashboard, Ask InLeagle research thread with streaming answers and collapsible citations, Case Library, saved research, keyboard search (⌘K), mobile-responsive layout
* **Evaluation Suite**: 150-question benchmark dataset with retrieval evaluation, claim-level legal citation validation, RAGAS adapter, and financial calculation tests
* **Deployment**: `Hugging Face Spaces` (Public hosting, Docker SDK, exposed port 7860)

### Planned / In Development
* **Named Entity Recognition (NER)**: `OpenNyAI NER` (Extracts petitioners, respondents, judges, courts, statutes, and precedents with 85%+ F1 score)
* **Scanned PDF OCR**: `Tesseract OCR v5.x` (For scanned legal documents)
* **Database**: `PostgreSQL` / `SQLite` (For case metadata and anonymized user feedback logs)
* **Knowledge Graph**: PostgreSQL-backed graph for statutory relationships (`INTERPRETS`, `AMENDS`, `SUPERSEDES`)

---

## Features & Functionalities

### 1. Semantic Case Search & Retrieval
* **Natural Language Queries**: Users can describe a banking dispute in plain English (e.g., *"What is my remedy if the bank issues a Section 13(2) notice under SARFAESI?"*).
* **Focused Retrieval**: Searches and returns the top 5 semantically relevant statutory sections, RBI master circulars, or judicial precedents from the Qdrant database in under 2 seconds (P90).
* **Expandable Result Cards**: Displays case/statute title, citation, court, judgment date, presiding judge, and an excerpt.

### 2. Legal Q&A Assistant (Ask InLeagle)
* **Multi-Mode Responses**: Supports three prompt modes:
  * **Auto-Detect**: Automatically classifies user queries into layman or legal intents.
  * **Simple Layman**: Empathic, action-oriented responses in plain English without complex jargon.
  * **Formal Legal**: Section-heavy, formal legal analysis citing exact acts and codes.
* **Conversational Memory**: Supports follow-up questions with query reformulation for consistent multi-turn context.
* **Streaming Response Reveal**: Animated reveal with expandable citation drawer.

### 3. Evaluation & Metrics Suite
* **150-Question Benchmark**: Standardized dataset across 10 categories:
  * SARFAESI Act, 2002
  * Insolvency and Bankruptcy Code (IBC), 2016
  * Negotiable Instruments Act (NI Act), 1881
  * Banking Regulation Act, 1949
  * RBI Master Directions & Regulatory Circulars
  * Recovery of Debts and Bankruptcy Act (RDB Act / DRT), 1993
  * Consumer Protection Act, 2019 (Banking Deficiency)
  * Financial & Numeric Calculations (EMI, Penal charges, Pre-deposits)
  * Deposit Insurance (DICGC Act), 1961
  * Credit Information (CIBIL / CICRA), 2005
* **Evaluation Endpoints**:
  * `GET /evaluation/summary`: Returns the latest evaluation report JSON.
  * `GET /evaluation/benchmark`: Fetches benchmark questions and metadata.
  * `POST /evaluation/run`: Triggers an automated evaluation pass.
  * `GET /evaluation/report`: Renders the Markdown evaluation report in HTML.

---

## System Architecture

```mermaid
graph TD
    subgraph Ingestion Pipeline
        A[PDF/Text Documents] --> B[pdfplumber Parser]
        B --> C[Recursive Character Text Splitter]
        C --> D[HuggingFace Embeddings InLegal-Sbert]
        D --> E[(Qdrant Cloud Vector Database)]
    end

    subgraph Query & RAG Pipeline
        User[User Query] --> UI[React Frontend]
        UI --> API[FastAPI Backend /query]
        API --> Mode{Mode Selection}
        Mode --> |Auto Detect| Intent[Intent Detector]
        Mode --> |Layman| PromptBuilder[Prompt Builder]
        Mode --> |Legal| PromptBuilder
        Intent --> PromptBuilder
        
        API --> Retrieve[Embed Query & Search]
        Retrieve --> |bhavyagiri/InLegal-Sbert| E
        E --> |Top-K Chunks| Context[Construct Legal Context]
        Context --> PromptBuilder
        
        PromptBuilder --> LLM[Groq Dynamic Model Inference]
        LLM --> Response[Structured JSON Response]
        Response --> UI
    end

    subgraph Evaluation Pipeline
        Bench[150-Question Benchmark] --> RetEval[Retrieval Evaluator]
        Bench --> CitEval[Claim-Level Citation Evaluator]
        Bench --> RagasAdap[RAGAS Adapter]
        Bench --> DocEval[Financial & Document Validator]
        RetEval --> Summary[Reports & Executive Dashboard]
        CitEval --> Summary
        RagasAdap --> Summary
        DocEval --> Summary
    end
```

---

## Installation & Execution Steps

### A. Backend Setup (FastAPI)

#### 1. Setup Virtual Environment
```bash
# Clone the repository
git clone https://github.com/InLEAGLE/inleagle
cd inleagle

# Create and activate virtual environment
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate
```

#### 2. Install Python Dependencies
```bash
pip install -r requirements.txt
```

#### 3. Environment Variables Configuration
Create a `.env` file in the root directory:
```env
GROQ_API_KEY=your_groq_api_key_here
# GROQ_MODEL is optional — the pipeline auto-discovers available Groq models at startup.
# Pin a specific model only if needed (e.g. GROQ_MODEL=qwen/qwen3.8-27b).
# GROQ_MODEL=qwen/qwen3.8-27b

# Response length controls
MAX_RESPONSE_TOKENS=400

# Qdrant Database Configuration
QDRANT_CLOUD_CLUSTER_URL=https://your_cluster_url.qdrant.io
QDRANT_CLOUD_API_KEY=your_qdrant_cloud_api_key_here
QDRANT_COLLECTION=Inleagle01

EMBEDDING_MODEL=bhavyagiri/InLegal-Sbert
HF_HOME=/app/hf_cache

# CORS
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

#### 4. Run the Data Ingestion Pipeline
```bash
# Ingest all legal documents into Qdrant
python -m app.ingestion.ingest

# Or ingest a single document:
python -m app.ingestion.ingest --doc sarfaesi
```

#### 5. Run the Backend Server
```bash
# Using the root launcher:
python run.py

# Or via uvicorn directly:
uvicorn app.main:app --host 0.0.0.0 --port 7860 --reload
```
Visit `http://localhost:7860` to access the modern React interface.

---

### B. Frontend Setup (React 19 + Tailwind)

The React frontend lives in `frontend/` and automatically connects to the FastAPI backend.

```bash
cd frontend
npm install
npm run dev      # Development server at http://localhost:3000
npm run build    # Production build to frontend/dist/
```

> In development, Vite auto-proxies `/query`, `/health`, and `/evaluation` to `http://localhost:7860`.
> In production, FastAPI serves `frontend/dist/` directly at `http://localhost:7860/`.

---

### C. Running the Evaluation & Latency Suites

#### 1. Measure End-to-End Latency & Throughput
Benchmark stage-level latency (InLegal-BERT embedding, Qdrant vector search, prompt assembly, and Groq LLM generation) with percentile distributions ($P_{50}, P_{90}, P_{99}$) and TPS throughput:

```bash
# Run end-to-end latency benchmark (default 10 sample questions):
python measure_latency.py --limit 10

# Benchmark embedding & Qdrant retrieval only (skipping LLM token consumption):
python measure_latency.py --limit 20 --skip-llm
```

#### 2. Run Consolidated Legal & Faithfulness Evaluation
Evaluate the RAG pipeline against the verified 150-question ground-truth benchmark (RAGAS Faithfulness, Jurisdiction Accuracy, Citation Precision/Coverage, and Statutory Accuracy):

```bash
# Run the complete evaluation pipeline:
python -m app.evaluation.runner

# Or test individual modules:
python -m app.evaluation.retrieval_eval
python -m app.evaluation.document_eval
```

Reports are automatically generated and viewable in the browser or via API:
- Interactive HTML Report: `http://localhost:7860/evaluation/report`
- Summary Metrics JSON: `http://localhost:7860/evaluation/summary`
- Benchmark Dataset Browser: `http://localhost:7860/evaluation/benchmark`

---

### D. Deployment via Docker on Hugging Face Spaces

InLEAGLE is containerized and ready for 1-click deployment on **Hugging Face Spaces** using the Docker SDK.

#### 1. Create a New Space
1. Log in to [Hugging Face](https://huggingface.co/) and click **New Space**.
2. Space Name: `inleagle` (or your preferred name).
3. Select **Docker** as the Space SDK and choose **Blank** template.
4. Select the Free CPU Tier (or higher).

#### 2. Configure Environment Secrets
Go to **Settings > Variables and secrets** in your Hugging Face Space and add:

| Secret Name | Value | Description |
|---|---|---|
| `GROQ_API_KEY` | `gsk_...` | Groq API Key — pipeline auto-discovers available models at startup |
| `GROQ_MODEL` | *(optional)* | Pin a specific Groq model (e.g. `qwen/qwen3.8-27b`); leave unset for auto-discovery |
| `MAX_RESPONSE_TOKENS` | `400` | Maximum tokens per LLM response (controls cost & latency) |
| `QDRANT_CLOUD_CLUSTER_URL` | `https://your-cluster-id.qdrant.io` | Qdrant Cloud endpoint |
| `QDRANT_CLOUD_API_KEY` | `eyJhbG...` | Qdrant API key |
| `QDRANT_COLLECTION` | `Inleagle01` | Indexed legal collection name |
| `EMBEDDING_MODEL` | `bhavyagiri/InLegal-Sbert` | Hugging Face embedding model |
| `HF_HOME` | `/app/hf_cache` | Path for cached model weights |

#### 3. Push Repository to Hugging Face
```bash
# Add Hugging Face Space as a git remote
git remote add space https://huggingface.co/spaces/<your-username>/<your-space-name>

# Push branch to Space main
git push space v2:main
```

The Space will automatically build the `Dockerfile`, pre-cache `InLegal-Sbert` weights, expose port `7860`, and serve both the React UI and FastAPI endpoints.

