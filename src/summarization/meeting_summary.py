from collections.abc import Iterable, Mapping
from typing import Any


DECISION_MARKERS = ("มีมติ", "มติให้", "ตกลง", "อนุมัติ", "สรุปว่า", "ตัดสินใจ")
RISK_MARKERS = ("ความเสี่ยง", "เสี่ยง", "ปัญหา", "ยังไม่ได้", "ไม่ครบ", "ล่าช้า", "ติดขัด")
IMPORTANT_MARKERS = ("ความคืบหน้า", "ระบบ", "โครงการ", "งบประมาณ", "ออกแบบ", "พัฒนา", "ข้อมูล")


def extract_meeting_summary(
    rows: Iterable[Mapping[str, Any]],
    action_items: Iterable[Mapping[str, Any]],
    max_items: int = 4,
) -> dict[str, list[str]]:
    texts = [" ".join(str(row.get("text", "")).split()) for row in rows]
    texts = [text for text in texts if text]
    decisions = _matching(texts, DECISION_MARKERS, max_items)
    risks = _matching(texts, RISK_MARKERS, max_items)
    used = set(decisions + risks)
    important_points = [text for text in _matching(texts, IMPORTANT_MARKERS, max_items * 2) if text not in used][:max_items]
    follow_ups = []
    for item in action_items:
        owner = str(item.get("owner", "")).strip()
        task = str(item.get("task", "")).strip()
        deadline = str(item.get("deadline") or "").strip()
        if owner and task:
            follow_ups.append(f"{owner}: {task}" + (f" (กำหนด {deadline})" if deadline else ""))
        if len(follow_ups) == max_items:
            break
    return {
        "overview": "",
        "decisions": decisions,
        "risks": risks,
        "important_points": important_points,
        "follow_ups": follow_ups,
    }


def _matching(texts: list[str], markers: tuple[str, ...], limit: int) -> list[str]:
    matches = []
    for text in texts:
        if any(marker in text for marker in markers) and text not in matches:
            matches.append(text)
        if len(matches) == limit:
            break
    return matches


if __name__ == "__main__":
    summary = extract_meeting_summary(
        [{"text": "ที่ประชุมมีมติให้ปรับงบประมาณ"}, {"text": "มีความเสี่ยงเรื่องข้อมูลไม่ครบ"}],
        [{"owner": "ฝ่ายขาย", "task": "ส่งรายงาน", "deadline": "วันศุกร์"}],
    )
    assert summary["decisions"] == ["ที่ประชุมมีมติให้ปรับงบประมาณ"]
    assert summary["follow_ups"] == ["ฝ่ายขาย: ส่งรายงาน (กำหนด วันศุกร์)"]
