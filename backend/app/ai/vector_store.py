"""
ChromaDB vector store wrapper for semantic event search.
Powered by neural sentence embeddings and fine-grained clause-level MaxSim matching.
"""
import chromadb
from chromadb.utils import embedding_functions
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import re

from app.config import CHROMA_DIR, CHROMA_COLLECTION_NAME


def _compute_lexical_score(query: str, caption: str) -> float:
    """
    Compute lexical keyword & phrase overlap score between 0.0 and 100.0.
    Acts as an exact-keyword booster for plate numbers, specific brands, and codes.
    All semantic comprehension is handled natively by neural embedding MaxSim.
    """
    if not caption:
        return 0.0

    q_words = [w.strip().lower() for w in re.split(r"\W+", query) if len(w.strip()) >= 2]
    if not q_words:
        return 0.0

    caption_lower = caption.lower()
    clean_query = query.lower().strip()

    # Exact query phrase match
    if len(q_words) > 1:
        phrase_pattern = rf'\b{re.escape(clean_query)}\b'
        for m in re.finditer(phrase_pattern, caption_lower):
            prefix = caption_lower[max(0, m.start() - 25):m.start()]
            if not re.search(r'\b(?:no|without|zero|not any)\s+(\w+\s+)?$', prefix):
                return 100.0

    matches = 0
    total_weight = len(q_words)

    for word in q_words:
        # Generate naive stems for plural and tense inflections
        stems = [word]
        if word.endswith('s') and len(word) > 3:
            stems.append(word[:-1])
        if word.endswith('ing') and len(word) > 4:
            stems.extend([word[:-3], word[:-3] + 'e'])
        if word.endswith('ed') and len(word) > 3:
            stems.extend([word[:-2], word[:-1]])
        if word.endswith('es') and len(word) > 4:
            stems.append(word[:-2])

        matched = False
        for stem in stems:
            pattern = rf'\b{re.escape(stem)}s?\b'
            for match in re.finditer(pattern, caption_lower):
                prefix = caption_lower[max(0, match.start() - 25):match.start()]
                if re.search(r'\b(?:no|without|zero|not any)\s+(\w+\s+)?$', prefix):
                    continue
                matched = True
                break
            if matched:
                break

        if matched:
            matches += 1

    return (matches / total_weight) * 100.0


_COLOR_WORDS = {
    "yellow", "blue", "red", "green", "black", "white", "orange",
    "purple", "pink", "gray", "grey", "brown", "silver", "gold"
}


class VectorStore:
    """
    Manages ChromaDB persistent storage and neural semantic event retrieval.
    Employs fine-grained clause-level MaxSim pooling to prevent macro-scene
    caption dilution and enable high-fidelity understanding of any NLP query.
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
            cls._instance._clause_cache = {}
        return cls._instance

    def _ensure_initialized(self):
        if self._initialized:
            return
        self._client = chromadb.PersistentClient(path=str(CHROMA_DIR))
        self._embedding_fn = embedding_functions.DefaultEmbeddingFunction()
        self._collection = self._client.get_or_create_collection(
            name=CHROMA_COLLECTION_NAME,
            embedding_function=self._embedding_fn,
            metadata={"hnsw:space": "cosine"},
        )
        self._clause_cache = {}
        self._initialized = True
        print(f"[VectorStore] ChromaDB ready. Collection size: {self._collection.count()}")

    def _get_clause_embs(self, doc: str) -> Tuple[List[str], np.ndarray]:
        """
        Break a detailed event caption into constituent semantic clauses
        and return normalized embeddings for fine-grained MaxSim matching.
        Results are cached in memory for sub-millisecond retrieval.
        """
        if doc in self._clause_cache:
            return self._clause_cache[doc]

        sentences = [
            s.strip() for s in re.split(r'[.!?]|\bSubject details:\b|\bVisible text and signs:\b', doc)
            if len(s.strip()) > 5
        ]
        targets = [doc] + sentences
        embs = np.array(self._embedding_fn(targets), dtype=np.float32)
        norms = np.linalg.norm(embs, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        embs = embs / norms
        self._clause_cache[doc] = (targets, embs)
        return targets, embs

    def index_events(
        self,
        video_id: str,
        events: List[Dict[str, Any]],
        camera_id: Optional[str] = None,
    ) -> List[str]:
        """
        Index a list of events into ChromaDB.

        Args:
            video_id: Unique video identifier.
            events: List of {"timestamp": float, "caption": str}
            camera_id: Optional camera identifier for filtering.

        Returns:
            List of generated ChromaDB document IDs.
        """
        self._ensure_initialized()

        if not events:
            return []

        ids = []
        documents = []
        metadatas = []

        for idx, ev in enumerate(events):
            ts = ev["timestamp"]
            doc_id = f"{video_id}_{idx:04d}_{ts:.2f}"
            ids.append(doc_id)
            documents.append(ev["caption"])
            
            import json
            bbox_str = json.dumps(ev["bbox"]) if ev.get("bbox") else ""
            
            metadatas.append({
                "video_id": video_id,
                "camera_id": camera_id or "",
                "timestamp": float(ts),
                "time_str": f"{int(ts // 60):02d}:{int(ts % 60):02d}",
                "bbox": bbox_str,
            })

        self._collection.upsert(ids=ids, documents=documents, metadatas=metadatas)
        print(f"[VectorStore] Indexed {len(events)} events for video '{video_id}'. Total: {self._collection.count()}")
        return ids

    def search(
        self,
        query: str,
        n_results: int = 10,
        video_id: Optional[str] = None,
        camera_id: Optional[str] = None,
        min_score: float = 0.0,
        deduplicate_window_sec: float = 6.0,
    ) -> List[Dict[str, Any]]:
        """
        Hybrid Semantic + Lexical search over indexed events with
        Temporal Non-Maximum Suppression (deduplication) and strict relevance gating.
        """
        self._ensure_initialized()

        if self._collection.count() == 0:
            return []

        # Build metadata filter
        where_filter = None
        conditions = []
        if video_id:
            conditions.append({"video_id": video_id})
        if camera_id:
            conditions.append({"camera_id": camera_id})

        if len(conditions) == 1:
            where_filter = conditions[0]
        elif len(conditions) > 1:
            where_filter = {"$and": conditions}

        # Fetch dense vector candidates
        results = self._collection.query(
            query_texts=[query],
            n_results=min(n_results * 3, max(1, self._collection.count())),
            where=where_filter,
        )

        formatted = []
        if not results["documents"] or not results["documents"][0]:
            return formatted

        docs = results["documents"][0]
        metas = results["metadatas"][0]
        distances = results["distances"][0] if results.get("distances") else [0.0] * len(docs)

        # Compute normalized query embedding for neural MaxSim re-ranking
        q_raw = np.array(self._embedding_fn([query])[0], dtype=np.float32)
        q_norm = np.linalg.norm(q_raw)
        q_emb = q_raw / (q_norm if q_norm > 0 else 1.0)

        q_words = set(re.findall(r"[a-z0-9]+", query.lower()))
        q_colors = q_words & _COLOR_WORDS

        candidates = []
        for doc, meta, dist in zip(docs, metas, distances):
            # Fine-grained clause-level MaxSim pooling across the document
            targets, embs = self._get_clause_embs(doc)
            sims = np.dot(embs, q_emb)
            best_idx = int(np.argmax(sims))
            max_sem = float(sims[best_idx]) * 100.0
            best_clause = targets[best_idx]
            lex_s = _compute_lexical_score(query, doc)

            # True NLP Relevance Gating & Semantic Calibration
            if max_sem < 25.0 and lex_s < 90.0:
                # Semantic distance too high and no exact keyword match -> irrelevant
                final_score = 0.0
            else:
                # Non-linear scaling of neural semantic similarity
                scaled_sem = max(0.0, (max_sem - 20.0) / (65.0 - 20.0)) * 100.0
                if lex_s >= 99.0:
                    final_score = max(75.0 + 0.25 * max_sem, 0.4 * scaled_sem + 0.6 * lex_s)
                elif lex_s > 0:
                    final_score = 0.6 * scaled_sem + 0.4 * lex_s
                else:
                    final_score = scaled_sem

                # Color qualifier strictness: if query explicitly specified a color, require it
                if q_colors and not any(c in doc.lower() for c in q_colors):
                    final_score *= 0.35

            match_score = round(min(100.0, max(0.0, final_score)), 1)

            candidates.append({
                "timestamp": meta["timestamp"],
                "time_str": meta["time_str"],
                "caption": doc,
                "best_clause": best_clause,
                "video_id": meta["video_id"],
                "camera_id": meta.get("camera_id", ""),
                "bbox": meta.get("bbox", ""),
                "match_score": match_score,
            })

        # Effective minimum score floor: drop anything below threshold or 0.0
        effective_min = max(35.0, min_score) if min_score <= 0.0 else min_score

        # Sort candidates by match_score descending before deduplication
        candidates.sort(key=lambda x: x["match_score"], reverse=True)

        formatted = []
        for c in candidates:
            if c["match_score"] < effective_min or c["match_score"] <= 0.0:
                continue

            # Temporal Non-Maximum Suppression (deduplication):
            # If an accepted event is from the same video within deduplicate_window_sec, suppress
            if deduplicate_window_sec > 0:
                is_suppressed = False
                for accepted in formatted:
                    if accepted["video_id"] == c["video_id"] and abs(accepted["timestamp"] - c["timestamp"]) < deduplicate_window_sec:
                        is_suppressed = True
                        break
                if is_suppressed:
                    continue

            formatted.append({
                "timestamp": c["timestamp"],
                "time_str": c["time_str"],
                "caption": c["caption"],
                "best_clause": c["best_clause"],
                "video_id": c["video_id"],
                "camera_id": c["camera_id"],
                "match_score": c["match_score"],
                "bbox": c["bbox"],
            })
            if len(formatted) >= n_results:
                break

        return formatted

    def delete_video_events(self, video_id: str):
        """Remove all events for a specific video from the vector store."""
        self._ensure_initialized()
        try:
            self._collection.delete(where={"video_id": video_id})
            print(f"[VectorStore] Deleted events for video '{video_id}'.")
        except Exception as e:
            print(f"[VectorStore] Error deleting events for '{video_id}': {e}")

    def get_collection_count(self) -> int:
        self._ensure_initialized()
        return self._collection.count()
