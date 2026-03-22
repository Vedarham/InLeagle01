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
import logging
from pathlib import Path

from dotenv import load_dotenv
from groq import Groq

load_dotenv()
log = logging.getLogger("rag_pipeline")

sys.path.append(str(Path(__file__).parent.parent))

from retrieval.vectorstore   import search
from generation.prompt_builder import build_prompt

# ─────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────

GROQ_API_KEY  = os.getenv("GROQ_API_KEY")
GROQ_MODEL    = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
TOP_K         = 5      # chunks to retrieve
MAX_TOKENS    = 1024   # max tokens in LLM response


# ─────────────────────────────────────────────────────────────
# GROQ CLIENT  (singleton)
# ─────────────────────────────────────────────────────────────

_groq_client = None

def get_groq_client() -> Groq:
    global _groq_client
    if _groq_client is None:
        if not GROQ_API_KEY:
            raise ValueError("GROQ_API_KEY not found in .env")
        _groq_client = Groq(api_key=GROQ_API_KEY)
    return _groq_client

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

def ask(
    query:       str,
    mode:        str = "auto",     # "auto" | "legal" | "layman"
    top_k:       int = TOP_K,
    source_type: str = None,       # optionally restrict to "act"/"case"/"rbi_circular"
) -> dict:
    """
    Full RAG pipeline: retrieve → prompt → LLM → response.
    Returns a dict with:
        answer      : the LLM's answer string
        mode        : which mode was used (legal / layman)
        citations   : list of source documents used
        chunks      : raw retrieved chunks (for debugging)
        query       : original query
        error       : None if successful, error message if failed
    """

    # 1. Retrieve relevant chunks from Qdrant
    log.info(f"Retrieving chunks for: '{query[:60]}'")
    try:
        chunks = search(query, top_k=top_k, source_type=source_type)
    except Exception as e:
        log.error(f"Retrieval failed: {e}")
        return _error_response(query, f"Retrieval error: {e}")

    if not chunks:
        return {
            "query":     query,
            "answer":    "I could not find relevant legal information for your query "
                         "in the available documents. Please try rephrasing or consult "
                         "a banking lawyer directly.",
            "mode":      mode,
            "citations": [],
            "chunks":    [],
            "error":     None,
        }

    # 2. Build prompt
    try:
        system_prompt, user_prompt, resolved_mode = build_prompt(
            query=query,
            chunks=chunks,
            mode=mode,
        )
    except Exception as e:
        log.error(f"Prompt build failed: {e}")
        return _error_response(query, f"Prompt error: {e}")

    # 3. Call Groq LLM
    log.info(f"Calling Groq ({GROQ_MODEL}) in {resolved_mode} mode...")
    try:
        client   = get_groq_client()
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
            max_tokens=MAX_TOKENS,
            temperature=0.2,      # low temp = more precise, less hallucination
        )
        answer = response.choices[0].message.content.strip()
    except Exception as e:
        log.error(f"Groq call failed: {e}")
        return _error_response(query, f"LLM error: {e}")

    # 4. Extract citations from the chunks used
    citations = extract_citations(chunks)

    log.info(f"Answer generated — {len(answer)} chars, {len(citations)} sources cited")

    return {
        "query":     query,
        "answer":    answer,
        "mode":      resolved_mode,
        "citations": citations,
        "chunks":    chunks,
        "error":     None,
    }

def _error_response(query: str, error: str) -> dict:
    return {
        "query":     query,
        "answer":    "An error occurred while processing your query.",
        "mode":      "unknown",
        "citations": [],
        "chunks":    [],
        "error":     error,
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
    print("  END-TO-END RAG PIPELINE TEST")
    print("=" * 70)

    for query, mode in test_cases:
        print(f"\n{'─' * 70}")
        print(f"❓QUERY ({mode.upper()} mode)")
        print(f"   {query}")
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

        print(f"\n   [Mode: {result['mode']} | "
              f"Chunks retrieved: {len(result['chunks'])}]")