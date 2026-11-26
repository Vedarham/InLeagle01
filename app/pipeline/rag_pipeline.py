""" The single entry point for everything.
Call ask() with a user question → get back a structured response
containing the answer, citations, mode used, and source chunks.
Usage:
    from pipeline.rag_pipeline import ask

    result = ask("My bank sent me a notice to take my property. What can I do?")
    print(result["answer"])
    print(result["citations"])
"""

import os
import re
import sys
import time
import logging
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()
log = logging.getLogger("rag_pipeline")

# Add app and root directory to sys.path to guarantee import resolution
_APP_DIR = Path(__file__).resolve().parent.parent
_ROOT_DIR = _APP_DIR.parent
for p in [str(_APP_DIR), str(_ROOT_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

try:
    from app.retrieval.vectorstore import search
    from app.generation.prompt_builder import build_prompt
except ImportError:
    from retrieval.vectorstore import search
    from generation.prompt_builder import build_prompt

# ─────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────

GROQ_API_KEY  = os.getenv("GROQ_API_KEY")
# Default to Meta's flagship Llama 3.3 70B model on Groq free tier
GROQ_MODEL    = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
# Fallback models in case of model retirement or token-per-minute limits
FALLBACK_MODELS = [
    GROQ_MODEL,
    "llama-3.3-70b-versatile",
    "llama-3.3-70b-specdec",
    "llama3-70b-8192",
    "llama3-8b-8192",
    "gemma2-9b-it",
    "deepseek-r1-distill-llama-70b",
]
TOP_K         = 5      # chunks to retrieve
MAX_TOKENS    = int(os.getenv("MAX_RESPONSE_TOKENS", "400"))   # strict response token budget to prevent waste & 429s
MAX_RESPONSE_CHARS = 2200  # maximum response characters for concise delivery


# ─────────────────────────────────────────────────────────────
# GROQ CLIENT  (singleton)
# ─────────────────────────────────────────────────────────────

_groq_client = None
_active_groq_models = None

def get_groq_client():
    global _groq_client
    if _groq_client is None:
        try:
            from groq import Groq
        except ImportError:
            raise ImportError("The 'groq' package is not installed. Run 'pip install groq'.")
        if not GROQ_API_KEY:
            raise ValueError("GROQ_API_KEY not found in .env")
        _groq_client = Groq(api_key=GROQ_API_KEY)
    return _groq_client


def get_active_groq_models() -> list[str]:
    """
    Dynamically queries Groq for currently supported active chat models,
    filtering out audio/TTS/guardrail endpoints and prioritizing high-throughput models
    over rate-limited experimental endpoints.
    """
    global _active_groq_models
    if _active_groq_models:
        return _active_groq_models

    client = get_groq_client()
    try:
        raw_list = client.models.list().data
        chat_candidates = []
        for m in raw_list:
            mid = m.id.lower()
            # Filter out non-chat models: audio, speech, guardrails, classifiers
            if any(b in mid for b in ["whisper", "prompt-guard", "safeguard", "orpheus", "tts", "audio", "vision"]):
                continue
            chat_candidates.append(m.id)

        # Prioritize high-throughput, high-quota models (Qwen, Llama)
        # Avoid heavy rate-limited experimental models (like openai/gpt-oss-120b)
        def model_rank(model_id: str) -> int:
            mid = model_id.lower()
            if "llama-3.3" in mid or "llama3.3" in mid:
                return 1
            if "qwen" in mid:
                return 2
            if "llama" in mid:
                return 3
            if "gemma" in mid:
                return 4
            if "gpt-oss-20b" in mid:
                return 5
            if "gpt-oss-120b" in mid:
                return 6  # Low quota on free tier (frequent 429s)
            return 10

        chat_candidates.sort(key=model_rank)
        log.info(f"Discovered and ranked active Groq models: {chat_candidates}")

        ranked = []
        if GROQ_MODEL in chat_candidates:
            ranked.append(GROQ_MODEL)
        for cand in chat_candidates:
            if cand not in ranked:
                ranked.append(cand)
        _active_groq_models = ranked if ranked else FALLBACK_MODELS
    except Exception as e:
        log.warning(f"Failed to query Groq model list: {e}")
        _active_groq_models = FALLBACK_MODELS

    return _active_groq_models

# ─────────────────────────────────────────────────────────────
# CITATION EXTRACTOR
# ─────────────────────────────────────────────────────────────

def extract_citations(chunks: list[dict]) -> list[str]:
    """
    Build a clean citation list from the source chunks that were actually used to answer the question.

    Eg output:
        ["SARFAESI Act 2002", "Mardia Chemicals v Union of India 2004 (Supreme Court)"]
    """
    seen  = set()
    cites = []

    for chunk in chunks:
        name   = chunk.get("document_name", "")
        stype  = chunk.get("source_type", "")
        court  = chunk.get("court", "")
        year   = chunk.get("year", "")

        if not name or name in seen:
            continue
        seen.add(name)

        if stype == "case" and court:
            cites.append(f"{name} ({court})")
        else:
            cites.append(name)

    return cites


# ─────────────────────────────────────────────────────────────
# CORE ask() FUNCTION
# ─────────────────────────────────────────────────────────────

def reformulate_query(query: str, history: list[dict]) -> str:
    """
    If there is chat history, use Groq to reformulate the user's latest query
    to be a standalone search query.
    """
    if not history:
        return query

    # Skip reformulation for greetings or extremely simple conversations
    q_lower = query.strip().lower()
    if q_lower in ["hello", "hi", "hey", "who are you", "what is your name", "who is inleagle", "thank you", "thanks"]:
        return query

    try:
        client = get_groq_client()
        system_prompt = (
            "You are an AI assistant that reformulates user follow-up questions to be standalone search queries for a vector database. "
            "Analyze the conversation history and the latest user query. "
            "If the latest query refers back to previous topics, terms, or context, rewrite it to be a standalone query containing all necessary context (e.g. specific Acts, Sections, or Case Names). "
            "If the latest query is already standalone, return it exactly as is. "
            "Do NOT answer the question. Return ONLY the reformulated query text, with absolutely no introduction or surrounding text."
        )

        history_text = ""
        for msg in history[-5:]:  # Check up to last 5 messages
            role = "User" if msg["role"] == "user" else "Assistant"
            history_text += f"{role}: {msg['content']}\n"

        user_prompt = f"CHAT HISTORY:\n{history_text}\nLATEST USER QUERY: {query}\n\nSTANDALONE QUERY:"

        response = None
        for cand in get_active_groq_models():
            try:
                response = client.chat.completions.create(
                    model=cand,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    max_tokens=80,
                    temperature=0.0,
                )
                if response:
                    break
            except Exception:
                continue

        if not response:
            return query
        reformulated = response.choices[0].message.content.strip()
        reformulated = re.sub(r'^["\'\s]+|["\'\s]+$', '', reformulated)
        log.info(f"Reformulated query: '{query}' -> '{reformulated}'")
        return reformulated
    except Exception as e:
        log.error(f"Query reformulation failed: {e}")
        return query


def ask(
    query:       str,
    mode:        str = "auto",     # "auto" | "legal" | "layman"
    top_k:       int = TOP_K,
    source_type: str = None,       # optionally restrict to "act"/"case"/"rbi_circular"
    history:     list[dict] = None, # chat history
) -> dict:
    """
    Full RAG pipeline: retrieve → prompt → LLM → response with stage-level latency tracking.
    Returns a dict with:
        answer      : the LLM's answer string
        mode        : which mode was used (legal / layman)
        citations   : list of source documents used
        chunks      : raw retrieved chunks (for debugging)
        query       : original query
        error       : None if successful, error message if failed
        latency     : dictionary breaking down latency per stage (ms) and throughput (TPS)
    """
    t_start = time.perf_counter()
    reformulate_ms = 0.0

    # 1. Reformulate query based on history if provided
    search_query = query
    if history:
        t_ref_start = time.perf_counter()
        search_query = reformulate_query(query, history)
        reformulate_ms = (time.perf_counter() - t_ref_start) * 1000

    # 2. Retrieve relevant chunks from Qdrant
    t_ret_start = time.perf_counter()
    log.info(f"Retrieving chunks for: '{search_query[:60]}'")
    try:
        chunks = search(search_query, top_k=top_k, source_type=source_type)
    except Exception as e:
        log.error(f"Retrieval failed: {e}")
        retrieval_ms = (time.perf_counter() - t_ret_start) * 1000
        return _error_response(
            query,
            f"Retrieval error: {e}",
            latency={
                "total_ms": round((time.perf_counter() - t_start) * 1000, 2),
                "retrieval_ms": round(retrieval_ms, 2),
                "prompt_prep_ms": 0.0,
                "llm_generation_ms": 0.0,
                "postprocess_ms": 0.0,
            }
        )
    retrieval_ms = (time.perf_counter() - t_ret_start) * 1000

    # 3. CRITICAL SAFEGUARD: Never resume on model answers when no data is received.
    # In legal QA, answering without retrieved authorities produces dangerous hallucinations.
    q_clean = query.strip().lower()
    is_greeting = q_clean in [
        "hello", "hi", "hey", "who are you", "what is your name",
        "who is inleagle", "good morning", "good evening", "good afternoon"
    ]

    if not chunks:
        t_total_ms = (time.perf_counter() - t_start) * 1000
        latency_info = {
            "total_ms": round(t_total_ms, 2),
            "retrieval_ms": round(retrieval_ms, 2),
            "prompt_prep_ms": 0.0,
            "llm_generation_ms": 0.0,
            "postprocess_ms": 0.0,
            "tokens_per_second": 0.0,
        }

        if is_greeting:
            return {
                "query":     query,
                "answer":    (
                    "Hello! I am InLEAGLE, an intelligent legal research assistant specialized in Indian banking law. "
                    "I can help you analyze the SARFAESI Act, Section 138 NI Act, Banking Regulation Act, IBC, RDB Act, "
                    "and RBI Master Directions. How may I assist you today?"
                ),
                "mode":      "layman",
                "citations": [],
                "chunks":    [],
                "error":     None,
                "latency":   latency_info,
            }

        log.warning(f"No chunks retrieved for query '{query[:60]}'. Halting pipeline to prevent ungrounded model answers.")
        return {
            "query":     query,
            "answer":    (
                "No relevant legal authorities, statutory provisions, or precedents were found in the indexed knowledge base "
                "for this query. Generation was halted to prevent ungrounded model answers or hallucinations. "
                "Please verify that the relevant statutes are indexed in the vectorstore or rephrase your query."
            ),
            "mode":      mode,
            "citations": [],
            "chunks":    [],
            "error":     "No data received from retrieval (empty chunks). Generation aborted to prevent ungrounded model answer.",
            "latency":   latency_info,
        }

    # 4. Build prompt (only executed when authentic data was retrieved)
    t_prompt_start = time.perf_counter()
    try:
        system_prompt, user_prompt, resolved_mode = build_prompt(
            query=query,
            chunks=chunks,
            mode=mode,
        )
    except Exception as e:
        log.error(f"Prompt build failed: {e}")
        return _error_response(query, f"Prompt error: {e}")
    prompt_prep_ms = (time.perf_counter() - t_prompt_start) * 1000

    # 5. Call Groq LLM with token budgeting and automatic fallback ladder
    t_llm_start = time.perf_counter()
    tokens_generated = 0
    try:
        client = get_groq_client()
        messages = [{"role": "system", "content": system_prompt}]
        
        if history:
            for msg in history[-2:]:
                content = str(msg.get("content", ""))
                if msg.get("role") != "user" and len(content) > 300:
                    content = content[:300].rstrip() + "... [truncated historical context]"
                messages.append({"role": msg.get("role", "user"), "content": content})
                
        messages.append({"role": "user", "content": user_prompt})

        models_to_try = get_active_groq_models()

        answer = None
        last_llm_err = None
        for candidate_model in models_to_try:
            try:
                log.info(f"Calling Groq ({candidate_model}) in {resolved_mode} mode...")
                response = client.chat.completions.create(
                    model=candidate_model,
                    messages=messages,
                    max_tokens=MAX_TOKENS,
                    temperature=0.2,      # low temp = more precise, less hallucination
                )
                answer = response.choices[0].message.content.strip()
                if hasattr(response, "usage") and response.usage:
                    tokens_generated = response.usage.completion_tokens or len(answer.split())
                else:
                    tokens_generated = int(len(answer.split()) * 1.3)
                break
            except Exception as call_err:
                err_str = str(call_err).lower()
                if "429" in err_str or "rate limit" in err_str:
                    log.warning(f"Groq model '{candidate_model}' hit 429 Rate Limit. Attempting next candidate fallback model...")
                    time.sleep(1.0)
                else:
                    log.warning(f"Groq call with model '{candidate_model}' failed: {call_err}. Trying fallback...")
                last_llm_err = call_err

        if not answer:
            return _error_response(query, f"LLM error: {last_llm_err}")

        # Cleanly truncate if response exceeded character ceiling
        if len(answer) > MAX_RESPONSE_CHARS:
            last_p = answer.rfind(".", 0, MAX_RESPONSE_CHARS)
            if last_p > 800:
                answer = answer[:last_p + 1]
            else:
                answer = answer[:MAX_RESPONSE_CHARS].rstrip() + "..."

    except Exception as e:
        log.error(f"Groq invocation failed: {e}")
        return _error_response(query, f"LLM error: {e}")

    llm_generation_ms = (time.perf_counter() - t_llm_start) * 1000

    # 6. Extract citations from the chunks used
    t_post_start = time.perf_counter()
    citations = extract_citations(chunks)
    postprocess_ms = (time.perf_counter() - t_post_start) * 1000

    total_ms = (time.perf_counter() - t_start) * 1000
    tps = round(tokens_generated / (llm_generation_ms / 1000.0), 2) if llm_generation_ms > 0 else 0.0

    log.info(f"Answer generated — {len(answer)} chars, {len(citations)} sources cited, latency: {round(total_ms, 1)}ms ({tps} TPS)")

    return {
        "query":     query,
        "answer":    answer,
        "mode":      resolved_mode,
        "citations": citations,
        "chunks":    chunks,
        "error":     None,
        "latency":   {
            "total_ms":           round(total_ms, 2),
            "retrieval_ms":       round(retrieval_ms, 2),
            "prompt_prep_ms":     round(prompt_prep_ms, 2),
            "llm_generation_ms":  round(llm_generation_ms, 2),
            "postprocess_ms":     round(postprocess_ms, 2),
            "tokens_per_second":  tps,
            "completion_tokens":  tokens_generated,
        }
    }

def _error_response(query: str, error: str, latency: dict = None) -> dict:
    return {
        "query":     query,
        "answer":    f"An error occurred while processing your query: {error}",
        "mode":      "unknown",
        "citations": [],
        "chunks":    [],
        "error":     error,
        "latency":   latency or {},
    }


# ─────────────────────────────────────────────────────────────
# CLI TEST
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(levelname)-8s  %(message)s",
    )
    test_cases = [
        ("My bank sent me a 60 day notice to take possession of my property. What can I do?", "layman"),
        ("What is the legal position of a borrower under Section 13(2) of SARFAESI Act?",     "legal"),
        ("A cheque bounce case has been filed against me. What happens next?",                 "layman"),
        ("My loan app is calling my family members and threatening them. Is this illegal?",    "layman"),
        ("I signed as personal guarantor for my company. Company went bankrupt. Am I liable?", "layman"),
        ("What did the Supreme Court hold in Mardia Chemicals regarding borrower rights?",     "legal"),
    ]

    print("\n" + "=" * 70)
    print("END-TO-END RAG PIPELINE TEST")
    print("=" * 70)

    for query, mode in test_cases:
        print(f"\n{'─' * 70}")
        print(f"❓QUERY ({mode.upper()} mode)")
        print(f"{query}")
        print(f"{'─' * 70}")

        result = ask(query, mode=mode)

        if result["error"]:
            print(f"ERROR: {result['error']}")
            continue

        print(f"\n💬ANSWER:")
        print(result["answer"])

        if result["citations"]:
            print(f"\n📌SOURCES USED:")
            for c in result["citations"]:
                print(f"   • {c}")

        print(f"\n [Mode: {result['mode']} | "
              f"Chunks retrieved: {len(result['chunks'])}]")