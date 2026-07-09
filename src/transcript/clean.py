import re
from collections.abc import Iterable, Mapping
from typing import Any


def clean_transcript_text(text: str, max_token_repeats: int = 2) -> str:
    if not isinstance(text, str):
        return ""
    if max_token_repeats < 1:
        raise ValueError("max_token_repeats must be at least 1")

    tokens = re.sub(r"\s+", " ", text).strip().split(" ")
    cleaned_tokens: list[str] = []

    for token in tokens:
        if not token:
            continue
        # ponytail: only trim spaced token repeats; add Thai segmentation if unspaced loops matter.
        if cleaned_tokens and token == cleaned_tokens[-1]:
            repeat_count = 1
            for previous in reversed(cleaned_tokens[:-1]):
                if previous != token:
                    break
                repeat_count += 1
            if repeat_count >= max_token_repeats:
                continue
        cleaned_tokens.append(token)

    return " ".join(cleaned_tokens)


def clean_transcript_rows(
    rows: Iterable[Mapping[str, Any]],
    text_key: str = "text",
    max_token_repeats: int = 2,
) -> list[dict[str, Any]]:
    cleaned_rows = []

    for row in rows:
        cleaned_text = clean_transcript_text(row.get(text_key, ""), max_token_repeats)
        if not cleaned_text:
            continue

        cleaned_row = dict(row)
        cleaned_row[text_key] = cleaned_text
        cleaned_rows.append(cleaned_row)

    return cleaned_rows


if __name__ == "__main__":
    rows = [
        {"timestamp": "00:00:00 - 00:00:05", "text": "  สวัสดี   ครับ ครับ ครับ  "},
        {"timestamp": "00:00:05 - 00:00:10", "text": "   "},
    ]
    assert clean_transcript_rows(rows) == [
        {"timestamp": "00:00:00 - 00:00:05", "text": "สวัสดี ครับ ครับ"}
    ]
    print("transcript clean self-check passed")
