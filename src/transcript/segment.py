from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class AudioSegment:
    index: int
    start_seconds: float
    end_seconds: float
    audio: Any


def split_audio(
    audio: Any,
    sample_rate: int,
    chunk_seconds: float,
    overlap_seconds: float = 0.0,
) -> list[AudioSegment]:
    if sample_rate <= 0:
        raise ValueError("sample_rate must be positive")
    if chunk_seconds <= 0:
        raise ValueError("chunk_seconds must be positive")
    if overlap_seconds < 0 or overlap_seconds >= chunk_seconds:
        raise ValueError("overlap_seconds must be non-negative and smaller than chunk_seconds")

    total_samples = len(audio)
    chunk_samples = max(1, round(chunk_seconds * sample_rate))
    overlap_samples = round(overlap_seconds * sample_rate)
    step_samples = chunk_samples - overlap_samples

    segments = []
    start_sample = 0

    # ponytail: fixed chunks are enough for Phase 6; add VAD later if boundary cuts dominate errors.
    while start_sample < total_samples:
        end_sample = min(start_sample + chunk_samples, total_samples)
        segments.append(
            AudioSegment(
                index=len(segments) + 1,
                start_seconds=start_sample / sample_rate,
                end_seconds=end_sample / sample_rate,
                audio=audio[start_sample:end_sample],
            )
        )

        if end_sample == total_samples:
            break

        start_sample += step_samples

    return segments


if __name__ == "__main__":
    segments = split_audio(list(range(10)), sample_rate=2, chunk_seconds=2, overlap_seconds=0.5)
    assert [(item.index, item.start_seconds, item.end_seconds, item.audio) for item in segments] == [
        (1, 0.0, 2.0, [0, 1, 2, 3]),
        (2, 1.5, 3.5, [3, 4, 5, 6]),
        (3, 3.0, 5.0, [6, 7, 8, 9]),
    ]
    print("segment self-check passed")
