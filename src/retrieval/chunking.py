from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class TranscriptChunk:
    index: int
    start_timestamp: str
    end_timestamp: str
    text: str
    row_count: int


def chunk_transcript_rows(
    rows: Iterable[Mapping[str, Any]],
    max_characters: int = 600,
    text_key: str = "text",
    timestamp_key: str = "timestamp",
) -> list[TranscriptChunk]:
    if max_characters <= 0:
        raise ValueError("max_characters must be positive")

    chunks: list[TranscriptChunk] = []
    current_rows: list[Mapping[str, Any]] = []
    current_texts: list[str] = []
    current_length = 0

    for row in rows:
        text = str(row.get(text_key, "")).strip()
        if not text:
            continue

        next_length = current_length + len(text) + (1 if current_texts else 0)
        if current_rows and next_length > max_characters:
            chunks.append(_build_chunk(len(chunks) + 1, current_rows, current_texts, timestamp_key))
            current_rows = []
            current_texts = []
            current_length = 0

        # ponytail: long single rows stay whole; split within a row only if real transcripts need it.
        current_rows.append(row)
        current_texts.append(text)
        current_length += len(text) + (1 if len(current_texts) > 1 else 0)

    if current_rows:
        chunks.append(_build_chunk(len(chunks) + 1, current_rows, current_texts, timestamp_key))

    return chunks


def _build_chunk(
    index: int,
    rows: list[Mapping[str, Any]],
    texts: list[str],
    timestamp_key: str,
) -> TranscriptChunk:
    return TranscriptChunk(
        index=index,
        start_timestamp=str(rows[0].get(timestamp_key, "")),
        end_timestamp=str(rows[-1].get(timestamp_key, "")),
        text="\n".join(texts),
        row_count=len(rows),
    )


if __name__ == "__main__":
    sample_rows = [
        {"timestamp": "00:00:00 - 00:00:05", "text": "เปิดประชุม"},
        {"timestamp": "00:00:05 - 00:00:10", "text": "หารืองบประมาณ"},
        {"timestamp": "00:00:10 - 00:00:15", "text": "ปิดประชุม"},
    ]
    sample_chunks = chunk_transcript_rows(sample_rows, max_characters=25)
    assert [chunk.row_count for chunk in sample_chunks] == [2, 1]
    assert sample_chunks[0].start_timestamp == "00:00:00 - 00:00:05"
    assert sample_chunks[0].end_timestamp == "00:00:05 - 00:00:10"
    print("chunking self-check passed")
