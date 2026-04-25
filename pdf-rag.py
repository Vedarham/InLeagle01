# ----------------------------
# 1. Load PDF
# ----------------------------
from langchain_community.document_loaders import UnstructuredPDFLoader

doc_path = ["./data/Negotiable-Instruments-Acts-1881.pdf",
            "./data/Banking-Regulation-Act-1949.pdf",
            "./data/IBC-Act-2016.pdf",
            "./data/Reserve-Bank-of-India-1934.pdf",
            "./data/SARFAESI-Act-2002.pdf",
            ]

if doc_path:
    for i in doc_path:
        loader = UnstructuredPDFLoader(file_path=i)
        data = loader.load()
        print(f"Doc {i} loading...")
else:
    raise ValueError("No document path provided.")

# ----------------------------
# 2. Split into Chunks
# ----------------------------
from langchain_text_splitters import RecursiveCharacterTextSplitter

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1200,
    chunk_overlap=300
)

chunks = text_splitter.split_documents(data)
print(f"Number of chunks created: {len(chunks)}")


# ----------------------------
# 3. Create Embeddings + Vector DB
# ----------------------------
import ollama
ollama.pull("nomic-embed-text")

from langchain_ollama import OllamaEmbeddings
from langchain_community.vectorstores import Chroma

embedding = OllamaEmbeddings(model="nomic-embed-text")

vector_db = Chroma.from_documents(
    documents=chunks,
    embedding=embedding,
    collection_name="simple-rag",
    persist_directory="./chroma_db"  
)

print("Done creating vector database...")


# ----------------------------
# 4. LLM Setup
# ----------------------------
from langchain_ollama import ChatOllama

model = "deepseek-r1"
llm = ChatOllama(model=model)


# ----------------------------
# 5. MultiQuery Retriever (FIXED)
# ----------------------------
from langchain_core.prompts import PromptTemplate
from langchain_classic.retrievers.multi_query import MultiQueryRetriever

QUERY_PROMPT = PromptTemplate(
    input_variables=["question"],
    template="""
You are an AI assistant.
Generate 3 different rephrased versions of the user's question 
to improve document retrieval from a vector database.
Separate each version with a newline.

Original question:
{question}
"""
)

retriever = MultiQueryRetriever.from_llm(
    retriever=vector_db.as_retriever(),
    llm=llm,
    prompt=QUERY_PROMPT
)


# ----------------------------
# 6. RAG Chain
# ----------------------------
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser

template = """
Answer the question using ONLY the context below.

Context:
{context}

Question:
{question}
"""

prompt = ChatPromptTemplate.from_template(template)

chain = (
    {"context": retriever, "question": RunnablePassthrough()}
    | prompt
    | llm
    | StrOutputParser()
)


# res = chain.invoke("What is the document about?")
# res = chain.invoke("How does the Act define Dishonour by non-payment?")
res = chain.invoke("Explain the Act define Dishonour by non-payment in layman terms?")
print(res)