# Once run
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams
from qdrant_client.models import PointStruct

import os
from dotenv import load_dotenv
load_dotenv()

LOCAL_URL  = "http://localhost:6333"
CLOUD_URL  = os.getenv("QDRANT_CLOUD_CLUSTER_URL")
API_KEY    = os.getenv("QDRANT_CLOUD_API_KEY")
COLLECTION = os.getenv("QDRANT_COLLECTION")

local = QdrantClient(url=LOCAL_URL)
cloud = QdrantClient(url=CLOUD_URL, api_key=API_KEY)

# Check if collection exists in cloud, if so delete and recreate
existing = [c.name for c in cloud.get_collections().collections]
if COLLECTION in existing:
    cloud.delete_collection(COLLECTION)
    print(f"Deleted existing collection")

cloud.create_collection(
    collection_name=COLLECTION,
    vectors_config=VectorParams(size=768, distance=Distance.COSINE)
)
print(f"Fresh collection created")



offset = None
batch_size = 100
total = 0
while True:
    points, offset = local.scroll(
        collection_name=COLLECTION,
        limit=batch_size,
        offset=offset,
        with_vectors=True,
        with_payload=True
    )

    if not points:
        break

    # Convert Record → PointStruct
    point_structs = [
        PointStruct(
            id      = str(p.id),
            vector  = p.vector,
            payload = p.payload or {}
        )
        for p in points
    ]

    cloud.upsert(collection_name=COLLECTION, points=point_structs)
    total += len(point_structs)
    print(f"Migrated {total} points...")

    if offset is None:
        break

print(f"Migration complete — {total} total points in Qdrant Cloud")