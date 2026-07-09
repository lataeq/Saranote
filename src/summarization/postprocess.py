import re
from collections.abc import Iterable


NO_EVIDENCE_MESSAGE = "ไม่พบข้อมูลที่เกี่ยวข้องใน transcript"


def clean_summary_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def format_meeting_minutes_answer(points: Iterable[str]) -> str:
    cleaned_points = [clean_summary_text(point) for point in points]
    cleaned_points = [point for point in cleaned_points if point]

    if not cleaned_points:
        return NO_EVIDENCE_MESSAGE
    if len(cleaned_points) == 1:
        return f"จาก transcript ที่เกี่ยวข้อง: {cleaned_points[0]}"

    bullets = "\n".join(f"- {point}" for point in cleaned_points)
    return f"จาก transcript ที่เกี่ยวข้อง:\n{bullets}"


if __name__ == "__main__":
    assert clean_summary_text("  มีมติ   ปรับงบประมาณ  ") == "มีมติ ปรับงบประมาณ"
    assert format_meeting_minutes_answer([]) == NO_EVIDENCE_MESSAGE
    assert format_meeting_minutes_answer(["มีมติปรับงบประมาณ"]).startswith("จาก transcript")
    print("postprocess self-check passed")
