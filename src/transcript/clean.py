import re
from collections.abc import Iterable, Mapping
from typing import Any


COMMON_ASR_REPLACEMENTS = {
    "ฟาย": "ฝ่าย",
    "ฝาย": "ฝ่าย",
    "ดำเนื้องาน": "ดำเนินงาน",
    "งุบประมาณ": "งบประมาณ",
    "นกประมาณ": "งบประมาณ",
    "แผ่นงบประมาณ": "แผนงบประมาณ",
    "รถค่าใช้จ่าย": "ลดค่าใช้จ่าย",
    "ชะบับ": "ฉบับ",
    "ชบับ": "ฉบับ",
    "แก้ไข่": "แก้ไข",
    "ไพ้ใน": "ภายใน",
    "พายใน": "ภายใน",
    "วันสุข": "วันศุกร์",
    "ความเสียง": "ความเสี่ยง",
    "หลวดสอบ": "ตรวจสอบ",
    "รวดสอบ": "ตรวจสอบ",
    "ล็อกอีน": "ล็อกอิน",
    "อัพโลด": "อัปโหลด",
    "SQLไล": "SQLite",
    "File PDF": "ไฟล์ PDF",
}


def clean_transcript_text(text: str, max_token_repeats: int = 2) -> str:
    if not isinstance(text, str):
        return ""
    if max_token_repeats < 1:
        raise ValueError("max_token_repeats must be at least 1")

    text = text.replace("\u0e4d\u0e32", "\u0e33")

    for wrong, correct in COMMON_ASR_REPLACEMENTS.items():
        text = text.replace(wrong, correct)

    tokens = re.sub(r"\s+", " ", text).strip().split(" ")
    cleaned_tokens: list[str] = []

    for token in tokens:
        if not token:
            continue
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
        {"timestamp": "00:00:05 - 00:00:10", "text": "ฝ่ายดำเนื้องานต้องส่งเอกสารงุบประมาณชะบับแก้ไขไพ้ในวันสุข"},
        {"timestamp": "00:00:10 - 00:00:15", "text": "   "},
    ]
    assert clean_transcript_rows(rows) == [
        {"timestamp": "00:00:00 - 00:00:05", "text": "สวัสดี ครับ ครับ"},
        {
            "timestamp": "00:00:05 - 00:00:10",
            "text": "ฝ่ายดำเนินงานต้องส่งเอกสารงบประมาณฉบับแก้ไขภายในวันศุกร์",
        },
    ]
    print("transcript clean self-check passed")
