"""
Ingest Indian banking-law documents (acts, rules, RBI directions, cases) into Qdrant.

Usage:
    python ingest.py                       # everything in DOCUMENTS
    python ingest.py --doc ibc             # one document
    python ingest.py --doc ibc sarfaesi    # several documents
    python ingest.py --folder cases        # every doc whose PDF sits in that folder
    python ingest.py --recreate            # drop + recreate the collection first
    python ingest.py --dry-run             # parse + chunk only (no embedding / upload)
    python ingest.py --list                # show registry (and whether each file exists)
"""
import os
import re
import uuid
import logging
import argparse
from pathlib import Path
from typing import Optional

import pdfplumber

from dotenv import load_dotenv
load_dotenv()

from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from langchain_qdrant import QdrantVectorStore
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("ingest")

# ─────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────

# Data root: first candidate that exists (project root data, app/data, assets/data)
_here = Path(__file__).resolve().parent
_candidates = [
    _here.parent.parent / "data",
    _here.parent / "data",
    _here.parent.parent / "assets" / "data",
    _here.parent / "assets" / "data",
    _here / "assets" / "data",
]
RAW_DIR = next((c for c in _candidates if c.exists()), _candidates[0])
PROCESSED_DIR = RAW_DIR / "processed"

# Source folders (match the repo layout under assets/data)
BANKING  = RAW_DIR / "banking"
CASES    = RAW_DIR / "cases"
CONSUMER = RAW_DIR / "consumer_and_credit_protection"
RECOVERY = RAW_DIR / "loan_recovery_and_insolvency"
RBI      = RAW_DIR / "rbi_documents"

# Chunking
CHUNK_SIZE    = 512
CHUNK_OVERLAP = 80
MIN_CHUNK_LEN = 80

# Qdrant
QDRANT_URL      = os.getenv("QDRANT_CLOUD_CLUSTER_URL") or os.getenv("QDRANT_URL") or "http://localhost:6333"
QDRANT_API_KEY  = os.getenv("QDRANT_CLOUD_API_KEY") or ""
COLLECTION_NAME = os.getenv("QDRANT_COLLECTION") or "inleagle_legal"
VECTOR_DIM      = 768
UPLOAD_BATCH    = 64

# Embedding model
# bhavyagiri/InLegal-Sbert is a sentence-transformer variant of InLegalBERT
# output dim = 768, trained on Indian legal corpus — correct choice
MODEL_NAME = "bhavyagiri/InLegal-Sbert"

# ─────────────────────────────────────────────────────────────
# DOCUMENT REGISTRY
# ─────────────────────────────────────────────────────────────
# NOTE: Qdrant payload via LangChain does not reliably handle list values,
# so topic_tags is a comma-separated string.
# TODO items: truncated filenames (SARFAESI Act, RBI Prudential Norms),
# unknown RBI years, and case years should be verified against the PDFs.

DOCUMENTS = {

    # ── BANKING ─────────────────────────────────────────────

    "banking_cos_acquisition": {
        "path": BANKING / "Banking Companies (Acquisition and Transfer of Undertakings) Acts.pdf",
        "slice_from": None,
        "metadata": {
            "source_type":   "act",
            "document_name": "Banking Companies (Acquisition and Transfer of Undertakings) Acts 1970 & 1980",
            "year":          1970,
            "topic_tags": "bank nationalisation,acquisition of undertakings,"
                          "nationalised banks,corresponding new bank,compensation",
        },
    },

    "banking_regulation": {
        "path": BANKING / "Banking Regulation Act.pdf",
        "slice_from": None,
        "metadata": {
            "source_type":   "act",
            "document_name": "Banking Regulation Act 1949",
            "year":          1949,
            "topic_tags": "bank license,RBI inspection,account refusal,bank merger,"
                          "deposit safety,RBI powers,bank winding up,BR Act",
        },
    },

    "banking_cos_act_1980": {
        "path": BANKING / "Banking-Companies-Act-1980_.pdf",
        "slice_from": None,
        "metadata": {
            "source_type":   "act",
            "document_name": "Banking Companies (Acquisition and Transfer of Undertakings) Act 1980",
            "year":          1980,
            "topic_tags": "bank nationalisation,nationalised banks,acquisition of undertakings,"
                          "public sector banks,compensation",
        },
    },

    "ni_act": {
        "path": BANKING / "Negotiable Instruments Act.PDF",
        "slice_from": ["138.", "Section 138", "138\n"],
        "metadata": {
            "source_type":   "act",
            "document_name": "Negotiable Instruments Act 1881",
            "year":          1881,
            "topic_tags": "cheque bounce,section 138,criminal liability,dishonour,"
                          "demand notice,director liability,stop payment,NI Act",
        },
    },

    "payment_settlement": {
        "path": BANKING / "Payment and Settlement Systems Act.pdf",
        "slice_from": None,
        "metadata": {
            "source_type":   "act",
            "document_name": "Payment and Settlement Systems Act 2007",
            "year":          2007,
            "topic_tags": "payment systems,UPI,NEFT,RTGS,digital payments,"
                          "payment system operator,RBI authorisation,settlement finality",
        },
    },

    "rbi_act": {
        "path": BANKING / "Reserve Bank of India Act.pdf",
        "slice_from": None,
        "metadata": {
            "source_type":   "act",
            "document_name": "Reserve Bank of India Act 1934",
            "year":          1934,
            "topic_tags": "RBI powers,monetary policy,NBFC registration,"
                          "currency issue,bank rate,RBI directions,RBI Act",
        },
    },

    "rrb_act": {
        "path": BANKING / "THE_REGIONAL_RURAL_BANKS_ACT_1976.PDF",
        "slice_from": None,
        "metadata": {
            "source_type":   "act",
            "document_name": "Regional Rural Banks Act 1976",
            "year":          1976,
            "topic_tags": "regional rural banks,RRB,sponsor bank,rural credit,"
                          "priority sector,RRB Act",
        },
    },

    # ── LOAN RECOVERY & INSOLVENCY ──────────────────────────

    "companies_act": {
        "path": RECOVERY / "Companies Act.pdf",
        "slice_from": None,
        "metadata": {
            "source_type":   "act",
            "document_name": "Companies Act 2013",
            "year":          2013,
            "topic_tags": "company law,director liability,winding up,charge registration,"
                          "NCLT,corporate borrower,Companies Act",
        },
    },

    "contract_act": {
        "path": RECOVERY / "Contract_Act_1872.pdf",
        "slice_from": None,
        "metadata": {
            "source_type":   "act",
            "document_name": "Indian Contract Act 1872",
            "year":          1872,
            "topic_tags": "contract,guarantee,surety liability,indemnity,breach of contract,"
                          "pledge,bailment,damages,loan agreement",
        },
    },

    "limitation_act": {
        "path": RECOVERY / "Limitation Act.pdf",
        "slice_from": None,
        "metadata": {
            "source_type":   "act",
            "document_name": "Limitation Act 1963",
            "year":          1963,
            "topic_tags": "limitation period,time barred debt,12 years mortgage,"
                          "3 years recovery,acknowledgment of debt,condonation of delay",
        },
    },

    "rdb_act": {
        "path": RECOVERY / "Recovery of Debts and Bankruptcy Act.pdf",
        "slice_from": None,
        "metadata": {
            "source_type":   "act",
            "document_name": "Recovery of Debts and Bankruptcy Act 1993",
            "year":          1993,
            "topic_tags": "DRT,DRAT,debt recovery tribunal,recovery certificate,"
                          "recovery officer,bank dues,RDB Act,RDDBFI",
        },
    },

    "sarfaesi": {
        # TODO: filename is truncated in the explorer screenshot
        # ("The_Securitisation_And_Reconstruction_Of_Financial_Assets_And_Enforcement_Of_Security_In...").
        # Paste the full filename here (or leave: the loader falls back to a glob match).
        "path": RECOVERY / "The_Securitisation_And_Reconstruction_Of_Financial_Assets_And_Enforcement_Of_Security_Interest_Act_2002.pdf",
        "slice_from": None,
        "metadata": {
            "source_type":   "act",
            "document_name": "SARFAESI Act 2002",
            "year":          2002,
            "topic_tags": "enforcement,security interest,property seizure,NPA,"
                          "borrower rights,DRT appeal,60 day notice,possession,auction",
        },
    },

    "sarfaesi_rules": {
        "path": RECOVERY / "The_Security_Interest_Enforcement_Rules_2002.PDF",
        "slice_from": None,
        "metadata": {
            "source_type":   "rules",
            "document_name": "Security Interest (Enforcement) Rules 2002",
            "year":          2002,
            "topic_tags": "SARFAESI rules,possession notice,auction procedure,"
                          "reserve price,sale notice,30 day notice,valuation,symbolic possession",
        },
    },

    "ibc": {
        "path": RECOVERY / "the-insolvency-and-bankruptcy-code-act,-2016.pdf",
        "slice_from": None,
        "metadata": {
            "source_type":   "act",
            "document_name": "Insolvency and Bankruptcy Code 2016",
            "year":          2016,
            "topic_tags": "insolvency,CIRP,moratorium,personal guarantor,liquidation,"
                          "financial creditor,NCLT,resolution plan,Section 14,IBC",
        },
    },

    "transfer_of_property": {
        "path": RECOVERY / "Transfer of Property Act.pdf",
        "slice_from": None,
        "metadata": {
            "source_type":   "act",
            "document_name": "Transfer of Property Act 1882",
            "year":          1882,
            "topic_tags": "mortgage,redemption,foreclosure,equitable mortgage,"
                          "mortgagee rights,sale of property,lease,charge",
        },
    },

    # ── CONSUMER & CREDIT PROTECTION ────────────────────────

    "ecommerce_rules": {
        "path": CONSUMER / "Consumer Protection (E-Commerce) Rules, 2020.pdf",
        "slice_from": None,
        "metadata": {
            "source_type":   "rules",
            "document_name": "Consumer Protection (E-Commerce) Rules 2020",
            "year":          2020,
            "topic_tags": "e-commerce,online seller,refund,grievance officer,"
                          "marketplace liability,consumer complaint online",
        },
    },

    "consumer_protection": {
        "path": CONSUMER / "Consumer Protection Act.pdf",
        "slice_from": None,
        "metadata": {
            "source_type":   "act",
            "document_name": "Consumer Protection Act 2019",  # TODO: confirm 1986 vs 2019
            "year":          2019,
            "topic_tags": "consumer complaint,deficiency in service,consumer commission,"
                          "unfair trade practice,product liability,compensation",
        },
    },

    "cic_act": {
        "path": CONSUMER / "Credit Information Companies (Regulation) Act.pdf",
        "slice_from": None,
        "metadata": {
            "source_type":   "act",
            "document_name": "Credit Information Companies (Regulation) Act 2005",
            "year":          2005,
            "topic_tags": "CIBIL,credit score,credit report,NPA wrongful tagging,"
                          "wilful defaulter,dispute credit record,CIC Act",
        },
    },

    "cic_regulations": {
        "path": CONSUMER / "Credit Information Companies Regulations 2006.pdf",
        "slice_from": None,
        "metadata": {
            "source_type":   "regulation",
            "document_name": "Credit Information Companies Regulations 2006",
            "year":          2006,
            "topic_tags": "credit information,credit report correction,"
                          "dispute resolution,data accuracy,credit institution obligations",
        },
    },

    "it_act": {
        "path": CONSUMER / "Information Technology Act.pdf",
        "slice_from": None,
        "metadata": {
            "source_type":   "act",
            "document_name": "Information Technology Act 2000",
            "year":          2000,
            "topic_tags": "cyber fraud,online fraud,phishing,identity theft,"
                          "electronic records,digital signature,data protection,IT Act",
        },
    },

    "pmla": {
        "path": CONSUMER / "Prevention of Money Laundering Act.pdf",
        "slice_from": None,
        "metadata": {
            "source_type":   "act",
            "document_name": "Prevention of Money Laundering Act 2002",
            "year":          2002,
            "topic_tags": "account freeze,money laundering,suspicious transaction,"
                          "ED attachment,FIU,provisional attachment,PMLA",
        },
    },

    # ── RBI DOCUMENTS ───────────────────────────────────────

    "rbi_prudential_norms": {
        # TODO: filename truncated in screenshot ("Prudentia..."). Paste full name.
        "path": RBI / "Prudential Norms.pdf",
        "slice_from": None,
        "metadata": {
            "source_type":   "rbi_circular",
            "document_name": "RBI Prudential Norms",
            "year":          None,
            "topic_tags": "prudential norms,income recognition,asset classification,"
                          "NPA,provisioning,SMA,standard asset",
        },
    },

    "rbi_complaint_mgmt": {
        "path": RBI / "RBI complaint management system guidance.pdf",
        "slice_from": None,
        "metadata": {
            "source_type":   "rbi_circular",
            "document_name": "RBI Complaint Management System Guidance",
            "year":          None,
            "topic_tags": "complaint management,grievance redressal,bank complaint,"
                          "complaint escalation,customer grievance,turnaround time",
        },
    },

    "rbi_sectoral_lending": {
        "path": RBI / "RBI directions concerning bank lending to different sectors.pdf",
        "slice_from": None,
        "metadata": {
            "source_type":   "rbi_circular",
            "document_name": "RBI Directions on Bank Lending to Different Sectors",
            "year":          None,
            "topic_tags": "priority sector lending,sectoral lending,agriculture loan,"
                          "MSME loan,housing loan,bank lending norms",
        },
    },

    "rbi_credit_cards": {
        "path": RBI / "RBI directions concerning credit card operations.pdf",
        "slice_from": None,
        "metadata": {
            "source_type":   "rbi_circular",
            "document_name": "RBI Directions on Credit Card Operations",
            "year":          None,
            "topic_tags": "credit card,card charges,interest on card,billing dispute,"
                          "card recovery,unsolicited card,card closure",
        },
    },

    "rbi_wilful_defaulters": {
        "path": RBI / "RBI directions concerning wilful defaulters.pdf",
        "slice_from": None,
        "metadata": {
            "source_type":   "rbi_circular",
            "document_name": "RBI Directions on Wilful Defaulters",
            "year":          None,
            "topic_tags": "wilful defaulter,defaulter classification,show cause notice,"
                          "diversion of funds,borrower rights,credit restrictions",
        },
    },

    "rbi_fair_practices": {
        "path": RBI / "RBI Fair Practices Code for Lenders.pdf",
        "slice_from": None,
        "metadata": {
            "source_type":   "rbi_circular",
            "document_name": "RBI Fair Practices Code for Lenders",
            "year":          None,
            "topic_tags": "fair practices code,bank lending regulation,"
                          "loan application process,interest rate transparency,"
                          "grievance redressal,penal charges",
        },
    },

    "rbi_customer_service": {
        "path": RBI / "RBI instructions on customer service in banks.pdf",
        "slice_from": None,
        "metadata": {
            "source_type":   "rbi_circular",
            "document_name": "RBI Instructions on Customer Service in Banks",
            "year":          None,
            "topic_tags": "customer service,bank charges,deposit accounts,"
                          "account closure,cheque collection,compensation to customer",
        },
    },

    "rbi_loan_recovery": {
        "path": RBI / "RBI instructions on loan recovery and enforcement.pdf",
        "slice_from": None,
        "metadata": {
            "source_type":   "rbi_circular",
            "document_name": "RBI Instructions on Loan Recovery and Enforcement",
            "year":          None,
            "topic_tags": "loan recovery,enforcement,NPA recovery,compromise settlement,"
                          "one time settlement,write off,borrower harassment",
        },
    },

    "rbi_recovery_agents": {
        "path": RBI / "RBI instructions on recovery agents.pdf",
        "slice_from": None,
        "metadata": {
            "source_type":   "rbi_circular",
            "document_name": "RBI Instructions on Recovery Agents",
            "year":          None,
            "topic_tags": "recovery agents,harassment,intimidation,calling hours,"
                          "agent conduct,outsourcing recovery,borrower privacy",
        },
    },

    "rbi_unauthorized_txn": {
        "path": RBI / "RBI instructions on unauthorized electronic banking transactions.pdf",
        "slice_from": None,
        "metadata": {
            "source_type":   "rbi_circular",
            "document_name": "RBI Instructions on Unauthorized Electronic Banking Transactions",
            "year":          None,
            "topic_tags": "unauthorized transaction,zero liability,limited liability,"
                          "fraud reporting,3 day reporting,card fraud,UPI fraud,bank liability",
        },
    },

    "rbi_integrated_ombudsman": {
        "path": RBI / "RBI Integrated Ombudsman Scheme.pdf",
        "slice_from": None,
        "metadata": {
            "source_type":   "rbi_circular",
            "document_name": "RBI Integrated Ombudsman Scheme 2021",
            "year":          2021,
            "topic_tags": "RBI ombudsman,integrated ombudsman,complaint against bank,"
                          "NBFC complaint,digital transaction complaint,"
                          "grievance redressal,consumer complaint",
        },
    },

    "rbi_kyc": {
        "path": RBI / "RBI Master Direction Know Your Customer (KYC).pdf",
        "slice_from": None,
        "metadata": {
            "source_type":   "rbi_circular",
            "document_name": "RBI Master Direction Know Your Customer (KYC) 2016",
            "year":          2016,
            "topic_tags": "KYC,customer due diligence,account opening,re-KYC,"
                          "video KYC,account freeze KYC,beneficial owner",
        },
    },

    # ── CASES ───────────────────────────────────────────────

    "ashok_saw_mill": {
        "path": CASES / "Authorized Officer, Indian Overseas Bank v. Ashok Saw Mill.PDF",
        "slice_from": None,
        "metadata": {
            "source_type":   "case",
            "document_name": "Authorized Officer, Indian Overseas Bank v Ashok Saw Mill 2009",
            "year":          2009,
            "court":         "Supreme Court",
            "topic_tags": "SARFAESI,secured creditor,DRT jurisdiction,section 13,"
                          "enforcement of security interest,settlement with bank",
        },
    },

    "bridgestone": {
        "path": CASES / "Bridgestone India Pvt. Ltd. v. Inderpal Singh.PDF",
        "slice_from": None,
        "metadata": {
            "source_type":   "case",
            "document_name": "Bridgestone India Pvt Ltd v Inderpal Singh 2015",
            "year":          2015,
            "court":         "Supreme Court",
            "topic_tags": "cheque bounce,section 138,compounding,"
                          "settlement after complaint,costs on accused",
        },
    },

    "central_bank_ravindra": {
        "path": CASES / "Central Bank of India v. Ravindra.PDF",
        "slice_from": None,
        "metadata": {
            "source_type":   "case",
            "document_name": "Central Bank of India v Ravindra 2001",
            "year":          2001,
            "court":         "Supreme Court",
            "topic_tags": "interest on loan,compound interest,bank interest dispute,"
                          "principal and interest appropriation,loan recovery",
        },
    },

    "dashrath_rupsingh": {
        "path": CASES / "Dashrath Rupsingh Rathod v. State of Maharashtra.PDF",
        "slice_from": None,
        "metadata": {
            "source_type":   "case",
            "document_name": "Dashrath Rupsingh Rathod v State of Maharashtra 2014",
            "year":          2014,
            "court":         "Supreme Court",
            "topic_tags": "cheque bounce jurisdiction,section 138,"
                          "where to file case,territorial jurisdiction",
        },
    },

    "icici_prakash_kaur": {
        "path": CASES / "ICICI Bank Ltd. v. Prakash Kaur.PDF",
        "slice_from": None,
        "metadata": {
            "source_type":   "case",
            "document_name": "ICICI Bank Ltd v Prakash Kaur 2007",
            "year":          2007,
            "court":         "Supreme Court",
            "topic_tags": "recovery agents,harassment,muscle power recovery,"
                          "vehicle repossession,borrower dignity,bank liability",
        },
    },

    "indian_bank_blue_jaggers": {
        "path": CASES / "Indian Bank v. Blue Jaggers Estates Ltd..PDF",
        "slice_from": None,
        "metadata": {
            "source_type":   "case",
            "document_name": "Indian Bank v Blue Jaggers Estates Ltd 2010",
            "year":          2010,
            "court":         "Supreme Court",
            "topic_tags": "SARFAESI,DRT,secured creditor,enforcement,bank recovery",
        },
    },

    "innoventive": {
        "path": CASES / "Innoventive Industries Ltd. v. ICICI Bank.PDF",
        "slice_from": None,
        "metadata": {
            "source_type":   "case",
            "document_name": "Innoventive Industries v ICICI Bank 2017",
            "year":          2017,
            "court":         "Supreme Court",
            "topic_tags": "IBC moratorium,CIRP Section 14,"
                          "recovery stopped insolvency,IBC overrides state law",
        },
    },

    "lalit_kumar_jain": {
        "path": CASES / "Lalit Kumar Jain v. Union of India.PDF",
        "slice_from": None,
        "metadata": {
            "source_type":   "case",
            "document_name": "Lalit Kumar Jain v Union of India 2021",
            "year":          2021,
            "court":         "Supreme Court",
            "topic_tags": "personal guarantor IBC,Section 95,"
                          "guarantor cannot hide behind moratorium,MSME guarantor",
        },
    },

    "mardia_chemicals": {
        "path": CASES / "Mardia Chemicals Ltd. v. Union of India.PDF",
        "slice_from": None,
        "metadata": {
            "source_type":   "case",
            "document_name": "Mardia Chemicals v Union of India 2004",
            "year":          2004,
            "court":         "Supreme Court",
            "topic_tags": "SARFAESI constitutional validity,borrower rights,"
                          "75 percent deposit DRT,constitutional challenge",
        },
    },

    "mathew_varghese": {
        "path": CASES / "Mathew Varghese v. M. Amritha Kumar.PDF",
        "slice_from": None,
        "metadata": {
            "source_type":   "case",
            "document_name": "Mathew Varghese v M Amritha Kumar 2014",
            "year":          2014,
            "court":         "Supreme Court",
            "topic_tags": "SARFAESI,limitation,pre-SARFAESI mortgage,"
                          "retrospective application,secured creditor,state recovery law",
        },
    },

    "meters_instruments": {
        "path": CASES / "Meters and Instruments Pvt. Ltd. v. Kanchan Mehta.PDF",
        "slice_from": None,
        "metadata": {
            "source_type":   "case",
            "document_name": "Meters and Instruments v Kanchan Mehta 2017",
            "year":          2017,
            "court":         "Supreme Court",
            "topic_tags": "cheque bounce settlement,section 138 closure,"
                          "pay compensation close case,accused exit route",
        },
    },

    "mobilox": {
        "path": CASES / "Mobilox Innovations Pvt. Ltd. v. Kirusa Software Pvt. Ltd..PDF",
        "slice_from": None,
        "metadata": {
            "source_type":   "case",
            "document_name": "Mobilox Innovations v Kirusa Software 2017",
            "year":          2017,
            "court":         "Supreme Court",
            "topic_tags": "IBC operational creditor,pre-existing dispute,"
                          "demand notice section 8,CIRP rejection,disputed debt",
        },
    },

    "rangappa": {
        "path": CASES / "Rangappa v. Sri Mohan.PDF",
        "slice_from": None,
        "metadata": {
            "source_type":   "case",
            "document_name": "Rangappa v Sri Mohan 2010",
            "year":          2010,
            "court":         "Supreme Court",
            "topic_tags": "cheque bounce,section 139 presumption,legally enforceable debt,"
                          "reverse burden,rebut presumption,section 138",
        },
    },

    "swiss_ribbons": {
        "path": CASES / "Swiss Ribbons Pvt. Ltd. v. Union of India.PDF",
        "slice_from": None,
        "metadata": {
            "source_type":   "case",
            "document_name": "Swiss Ribbons Pvt Ltd v Union of India 2019",
            "year":          2019,
            "court":         "Supreme Court",
            "topic_tags": "IBC constitutional validity,financial creditor vs operational creditor,"
                          "CoC,section 29A,upheld IBC",
        },
    },
}

# ─────────────────────────────────────────────────────────────
# PARSE FUNCTIONS
# ─────────────────────────────────────────────────────────────

_PAGE_NUM_RE = re.compile(r"^\s*(?:page\s*)?\d{1,4}\s*(?:of\s*\d{1,4})?\s*$", re.I)

_PUNCT_MAP = str.maketrans({
    "‘": "'", "’": "'", "“": '"', "”": '"',
    "–": "-", "—": "-", "•": "-", " ": " ",
    "₹": "Rs. ",
})


def _clean_text(text: str) -> str:
    text = text.replace("\x00", " ").replace("­", "")
    text = text.translate(_PUNCT_MAP)
    text = re.sub(r'\r\n', '\n', text)
    text = re.sub(r'(\w)-\n(\w)', r'\1\2', text)                    # re-join hyphenated line breaks
    text = "\n".join(ln for ln in text.split("\n") if not _PAGE_NUM_RE.match(ln))
    text = re.sub(r'[^\x09\x0A\x20-\x7E]', ' ', text)
    text = re.sub(r'[ \t]{2,}', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def parse_pdf(path: Path) -> str:
    text = ""
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"

    text = _clean_text(text)

    if len(text) < 300:
        raise ValueError(
            f"Only {len(text)} chars extracted from {path.name}.\n"
            f"  → File may be a scanned image PDF (needs OCR).\n"
            f"  → Try downloading a text-based version from IndiaCode/RBI."
        )
    return text


def parse_txt(path: Path) -> str:
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        return _clean_text(f.read())


def slice_from_keyword(text: str, keywords: list) -> str:
    for kw in keywords:
        idx = text.find(kw)
        if idx != -1:
            log.info(f"  Sliced from keyword '{kw}' at char {idx:,}")
            return text[idx:]
    log.warning(f"  None of {keywords} found — using full text")
    return text


def find_file(path: Path) -> Optional[Path]:
    """Exact path, else case-insensitive name match, else prefix match in the same folder."""
    if path.exists():
        return path
    folder = path.parent
    if not folder.exists():
        return None
    want = path.name.lower()
    for f in folder.iterdir():
        if f.name.lower() == want:
            return f
    # fallback for truncated / mistyped names: match on the first 30 chars of the stem
    stem = path.stem.lower()[:30]
    hits = [f for f in folder.iterdir()
            if f.suffix.lower() == path.suffix.lower() and f.stem.lower().startswith(stem)]
    if len(hits) == 1:
        log.warning(f"  Using closest match: {hits[0].name}")
        return hits[0]
    return None


def parse_document(doc_key: str, doc_config: dict) -> Optional[str]:
    path = find_file(Path(doc_config["path"]))

    if path is None:
        log.error(f"File not found: {doc_config['path']}")
        return None

    doc_config["_resolved_path"] = path
    log.info(f"Parsing: {path.name}  ({path.stat().st_size / 1024:.0f} KB)")

    try:
        ext = path.suffix.lower()
        if ext == ".pdf":
            text = parse_pdf(path)
        elif ext in (".txt", ".text"):
            text = parse_txt(path)
        else:
            log.error(f"Unsupported file type: {ext}")
            return None
    except Exception as e:
        log.error(f"Parse failed for {path.name}: {e}")
        return None

    if doc_config.get("slice_from"):
        text = slice_from_keyword(text, doc_config["slice_from"])

    log.info(f"  Extracted {len(text):,} characters")

    # Save processed text for inspection/debugging, mirroring the source folder
    save_dir = PROCESSED_DIR / path.parent.name
    save_dir.mkdir(parents=True, exist_ok=True)
    with open(save_dir / f"{doc_key}.txt", "w", encoding="utf-8") as f:
        f.write(text)

    return text

# ─────────────────────────────────────────────────────────────  
# CHUNK  →  LangChain Document objects
# ─────────────────────────────────────────────────────────────

def make_id(doc_key: str, idx: int) -> str:
    """Deterministic ID: re-running ingest overwrites a doc's chunks instead of duplicating."""
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"{doc_key}:{idx}"))


def chunk_document(doc_key: str, text: str, metadata: dict, source_file: str) -> list[Document]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", "; ", " ", ""],
        length_function=len,
    )

    raw_chunks = splitter.split_text(text)
    base_meta = {k: v for k, v in metadata.items() if v is not None}
    base_meta.update({"doc_key": doc_key, "source_file": source_file})

    docs = []
    skipped = 0
    for chunk in raw_chunks:
        chunk = chunk.strip()
        if len(chunk) < MIN_CHUNK_LEN:
            skipped += 1
            continue
        docs.append(Document(page_content=chunk, metadata=dict(base_meta)))

    for n, d in enumerate(docs):
        d.metadata["chunk_index"] = n
        d.metadata["chunk_total"] = len(docs)

    log.info(f"  Chunked → {len(docs)} documents  (skipped {skipped} short fragments)")
    return docs

# ─────────────────────────────────────────────────────────────
# EMBEDDING MODEL + QDRANT
# ─────────────────────────────────────────────────────────────

def load_embeddings() -> HuggingFaceEmbeddings:
    log.info(f"Loading embedding model: {MODEL_NAME}")
    return HuggingFaceEmbeddings(
        model_name=MODEL_NAME,
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True},
    )


def get_client() -> QdrantClient:
    return QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY or None, prefer_grpc=False, timeout=120)


def ensure_collection(client: QdrantClient, recreate: bool) -> None:
    exists = client.collection_exists(COLLECTION_NAME)
    if exists and recreate:
        log.warning(f"Dropping collection '{COLLECTION_NAME}'")
        client.delete_collection(COLLECTION_NAME)
        exists = False
    if not exists:
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=qmodels.VectorParams(size=VECTOR_DIM, distance=qmodels.Distance.COSINE),
        )
        log.info(f"Created collection '{COLLECTION_NAME}' (dim={VECTOR_DIM}, cosine)")

    # payload indexes so retrieval can filter by act / case / court / year
    for field in ("source_type", "document_name", "doc_key", "court"):
        try:
            client.create_payload_index(
                COLLECTION_NAME,
                field_name=f"metadata.{field}",
                field_schema=qmodels.PayloadSchemaType.KEYWORD,
            )
        except Exception:
            pass  # already exists
    try:
        client.create_payload_index(
            COLLECTION_NAME,
            field_name="metadata.year",
            field_schema=qmodels.PayloadSchemaType.INTEGER,
        )
    except Exception:
        pass

# ─────────────────────────────────────────────────────────────
# INGEST ONE DOCUMENT
# ─────────────────────────────────────────────────────────────

def ingest_one(
    doc_key: str,
    doc_config: dict,
    store: Optional[QdrantVectorStore],
) -> dict:
    doc_name = doc_config["metadata"]["document_name"]
    print(f"\n{'─' * 60}")
    log.info(f"[{doc_key.upper()}] {doc_name}")
    print(f"{'─' * 60}")

    text = parse_document(doc_key, doc_config)
    if text is None:
        return {"doc_key": doc_key, "status": "failed", "stage": "parse"}

    source_file = doc_config["_resolved_path"].name
    lc_docs = chunk_document(doc_key, text, doc_config["metadata"], source_file)
    if not lc_docs:
        return {"doc_key": doc_key, "status": "failed", "stage": "chunk"}

    if store is None:  # dry run
        return {"doc_key": doc_key, "status": "success", "chars": len(text), "chunks": len(lc_docs)}

    log.info(f"  Embedding and storing {len(lc_docs)} chunks in Qdrant...")
    try:
        for i in range(0, len(lc_docs), UPLOAD_BATCH):
            batch = lc_docs[i:i + UPLOAD_BATCH]
            ids = [make_id(doc_key, d.metadata["chunk_index"]) for d in batch]
            store.add_documents(batch, ids=ids)
    except Exception as e:
        log.error(f"  Upload failed: {e}")
        return {"doc_key": doc_key, "status": "failed", "stage": "upload"}

    log.info(f"  Done — {len(lc_docs)} chunks stored")
    return {"doc_key": doc_key, "status": "success", "chars": len(text), "chunks": len(lc_docs)}

# ─────────────────────────────────────────────────────────────
# MAIN PIPELINE
# ─────────────────────────────────────────────────────────────

def process_all_documents(target_keys: list[str], recreate: bool = False, dry_run: bool = False):
    store = None
    client = None
    if not dry_run:
        embeddings = load_embeddings()
        client = get_client()
        ensure_collection(client, recreate)
        store = QdrantVectorStore(client=client, collection_name=COLLECTION_NAME, embedding=embeddings)
        log.info("Embedding model and Qdrant ready\n")

    results = []
    for key in target_keys:
        results.append(ingest_one(key, DOCUMENTS[key], store))

    print("\n" + "=" * 60)
    print("  INGESTION SUMMARY" + ("  (dry run)" if dry_run else ""))
    print("=" * 60)

    ok  = [r for r in results if r["status"] == "success"]
    bad = [r for r in results if r["status"] != "success"]

    for r in ok:
        print(f"  OK     {r['doc_key']:<28} {r['chunks']:>5} chunks  {r['chars']:>9,} chars")
    for r in bad:
        print(f"  FAILED {r['doc_key']:<28} at: {r.get('stage', '?')}")

    print(f"\n  Processed : {len(ok)}/{len(results)} documents")
    if client is not None:
        total = client.count(COLLECTION_NAME, exact=True).count
        print(f"  Collection '{COLLECTION_NAME}' now holds {total:,} points")
    print("=" * 60)
    return 0 if not bad else 2

# ─────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(description="Ingest Indian banking law documents into Qdrant")
    parser.add_argument("--doc", nargs="+", default=None,
                        help=f"Ingest specific doc key(s). Options: {', '.join(DOCUMENTS.keys())}")
    parser.add_argument("--folder", type=str, default=None,
                        help="Ingest every doc from one folder: banking, cases, "
                             "consumer_and_credit_protection, loan_recovery_and_insolvency, rbi_documents")
    parser.add_argument("--recreate", action="store_true", help="Drop and recreate the collection first")
    parser.add_argument("--dry-run", action="store_true", help="Parse and chunk only; no embedding or upload")
    parser.add_argument("--list", action="store_true", help="List registry entries and file status, then exit")
    args = parser.parse_args()

    log.info(f"RAW_DIR = {RAW_DIR}")

    if args.list:
        for key, cfg in DOCUMENTS.items():
            found = find_file(Path(cfg["path"]))
            print(f"  {'OK     ' if found else 'MISSING'} {key:<28} {Path(cfg['path']).parent.name}/{Path(cfg['path']).name}")
        return 0

    if args.doc:
        bad = [k for k in args.doc if k not in DOCUMENTS]
        if bad:
            log.error(f"Unknown key(s) {bad}. Available: {list(DOCUMENTS.keys())}")
            return 1
        target_keys = args.doc
    elif args.folder:
        target_keys = [k for k, c in DOCUMENTS.items() if Path(c["path"]).parent.name == args.folder]
        if not target_keys:
            log.error(f"No documents registered under folder '{args.folder}'")
            return 1
    else:
        target_keys = list(DOCUMENTS.keys())

    if args.recreate and (args.doc or args.folder):
        log.error("--recreate wipes the whole collection; run it without --doc/--folder.")
        return 1

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    log.info(f"Documents to ingest: {len(target_keys)}")
    return process_all_documents(target_keys, recreate=args.recreate, dry_run=args.dry_run)


if __name__ == "__main__":
    raise SystemExit(main())