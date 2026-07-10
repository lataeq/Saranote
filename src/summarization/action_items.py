import re
from collections.abc import Iterable, Mapping
from typing import Any


ACTION_PATTERNS = (
    re.compile(
        r"(?P<owner>(?:ทุกฝ่าย|ฝ่าย[\u0e00-\u0e7f]+|ทีม[\u0e00-\u0e7f]+|คุณ[\u0e00-\u0e7f]+))"
        r"\s*ต้อง\s*(?P<body>.+)"
    ),
    re.compile(r"ขอให้\s*(?P<owner>ทุกฝ่าย)\s*(?P<body>.+)"),
)


def extract_action_items(rows: Iterable[Mapping[str, Any]]) -> list[dict[str, Any]]:
    action_items = []

    for row in rows:
        text = re.sub(r"\s+", " ", str(row.get("text", ""))).strip()
        matches = (pattern.search(text) for pattern in ACTION_PATTERNS)
        match = next((match for match in matches if match), None)
        if not match:
            continue

        task, deadline = _split_task_and_deadline(match.group("body"))
        if not task:
            continue

        # ponytail: explicit Thai assignment phrases only; use reviewed model extraction when phrasing varies.
        action_items.append(
            {
                "task": task,
                "owner": match.group("owner"),
                "deadline": deadline,
                "status": "pending",
                "approved": False,
                "evidence": {
                    "source": str(row.get("source", "transcript")),
                    "timestamp": str(row.get("timestamp", "")),
                    "text": text,
                },
            }
        )

    return action_items


def _split_task_and_deadline(body: str) -> tuple[str, str | None]:
    for marker in ("ภายใน", "ก่อน"):
        if marker in body:
            task, deadline = body.split(marker, 1)
            deadline = deadline.strip()
            return task.strip(), f"{marker}{deadline}" if marker == "ก่อน" else deadline

    return body.strip(), None


if __name__ == "__main__":
    items = extract_action_items(
        [
            {
                "timestamp": "00:00:21 - 00:00:29",
                "text": "ฝ่ายดำเนินงานต้องส่งเอกสารงบประมาณฉบับแก้ไขภายในวันศุกร์",
            }
        ]
    )
    assert items[0]["owner"] == "ฝ่ายดำเนินงาน"
    assert items[0]["deadline"] == "วันศุกร์"
    assert items[0]["approved"] is False
    print("action item self-check passed")
