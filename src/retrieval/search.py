import re
from collections.abc import Iterable
from dataclasses import dataclass

from src.retrieval.chunking import TranscriptChunk


MIN_NGRAM_SCORE = 0.35


@dataclass(frozen=True)
class SearchResult:
    chunk: TranscriptChunk
    score: float
    matched_terms: tuple[str, ...]


def search_chunks(query: str, chunks: Iterable[TranscriptChunk], top_k: int = 3) -> list[SearchResult]:
    if top_k <= 0:
        return []

    query_terms = _terms(query)
    query_grams = _ngrams(_compact(query))
    results = []

    for chunk in chunks:
        score, matched_terms = _score_chunk(chunk.text, query_terms, query_grams)
        if score:
            results.append(SearchResult(chunk=chunk, score=score, matched_terms=tuple(matched_terms)))

    return sorted(results, key=lambda result: (-result.score, result.chunk.index))[:top_k]


def _score_chunk(
    text: str,
    query_terms: list[str],
    query_grams: set[str],
) -> tuple[float, list[str]]:
    text_lower = text.lower()
    compact_text = _compact(text)
    matched_terms = sorted({term for term in query_terms if term in text_lower or term in compact_text})

    if matched_terms:
        return float(len(matched_terms)), matched_terms

    if not query_grams:
        return 0.0, []

    text_grams = _ngrams(compact_text)
    overlap = query_grams & text_grams
    if not overlap:
        return 0.0, []

    score = len(overlap) / len(query_grams)
    if score < MIN_NGRAM_SCORE:
        return 0.0, []

    return score, []


def _terms(text: str) -> list[str]:
    return re.findall(r"[0-9a-zA-Z\u0e00-\u0e7f]+", text.lower())


def _compact(text: str) -> str:
    return re.sub(r"[^0-9a-zA-Z\u0e00-\u0e7f]+", "", text.lower())


def _ngrams(text: str, size: int = 3) -> set[str]:
    if len(text) < size:
        return {text} if text else set()
    return {text[index : index + size] for index in range(len(text) - size + 1)}


if __name__ == "__main__":
    chunks = [
        TranscriptChunk(1, "00:00:00", "00:00:05", "เปิดประชุม", 1),
        TranscriptChunk(2, "00:00:05", "00:00:10", "ที่ประชุมมีมติเรื่องงบประมาณ", 1),
    ]
    results = search_chunks("งบประมาณ", chunks)
    assert results[0].chunk.index == 2
    assert search_chunks("", chunks) == []
    assert search_chunks("ใครเป็นผู้อนุมัติโครงการนี้", chunks) == []
    print("search self-check passed")
