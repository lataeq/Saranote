from collections.abc import Iterable

from src.retrieval.chunking import TranscriptChunk
from src.retrieval.search import search_chunks
from src.summarization.postprocess import format_meeting_minutes_answer


def summarize_from_context(question: str, transcript_context: Iterable[str], max_points: int = 3) -> str:
    if max_points <= 0:
        raise ValueError("max_points must be positive")

    lines = _context_lines(transcript_context)
    if not question.strip() or not lines:
        return format_meeting_minutes_answer([])

    line_chunks = [
        TranscriptChunk(index=index, start_timestamp="", end_timestamp="", text=line, row_count=1)
        for index, line in enumerate(lines, start=1)
    ]
    results = search_chunks(question, line_chunks, top_k=len(line_chunks))
    if not results:
        return format_meeting_minutes_answer([])

    best_score = results[0].score
    best_results = [result for result in results if result.score == best_score][:max_points]
    return format_meeting_minutes_answer(result.chunk.text for result in best_results)


def _context_lines(transcript_context: Iterable[str]) -> list[str]:
    seen = set()
    lines = []

    for item in transcript_context:
        for line in str(item).splitlines():
            cleaned = line.strip()
            if cleaned and cleaned not in seen:
                lines.append(cleaned)
                seen.add(cleaned)

    return lines


if __name__ == "__main__":
    answer = summarize_from_context(
        "ที่ประชุมมีมติเรื่องงบประมาณอย่างไร",
        ["เปิดประชุม", "ที่ประชุมมีมติให้ปรับแผนงบประมาณ"],
    )
    assert "งบประมาณ" in answer
    assert "เปิดประชุม" not in answer
    assert summarize_from_context("งบประมาณ", []) == "ไม่พบข้อมูลที่เกี่ยวข้องใน transcript"
    print("summarize self-check passed")
