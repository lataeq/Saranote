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
NATURAL_ASSIGNMENT_PATTERN = re.compile(
    r"มอบหมายงานให้\s*(?P<owner>.+?)\s*ไปทำต่อ.*?ข้อกำหนด.*?คือ(?:หนึ่ง)?\s*"
    r"(?P<body>.+?)\s*รบกวนส่งงาน.*?ภายใน(?P<deadline>[^\s]+)"
)


def extract_action_items(rows: Iterable[Mapping[str, Any]]) -> list[dict[str, Any]]:
    action_items = []
    normalized_rows = [
        (row, re.sub(r"\s+", " ", str(row.get("text", ""))).strip())
        for row in rows
    ]

    for index, (row, text) in enumerate(normalized_rows):
        evidence_timestamp = str(row.get("timestamp", ""))
        assignment_rows = normalized_rows[index : index + 5]
        assignment_text = " ".join(item_text for _, item_text in assignment_rows)
        assignment = NATURAL_ASSIGNMENT_PATTERN.search(assignment_text)
        if assignment:
            last_timestamp = str(assignment_rows[-1][0].get("timestamp", ""))
            deadline = re.sub(r"(?:นะครับ|ครับ)$", "", assignment.group("deadline"))
            tasks = [task.strip() for task in re.split(r"\s+และสอง\s+", assignment.group("body")) if task.strip()]
            for task in tasks:
                action_items.append(
                    {
                        "task": task,
                        "owner": assignment.group("owner").strip(),
                        "deadline": deadline,
                        "status": "pending",
                        "approved": False,
                        "evidence": {
                            "source": str(row.get("source", "transcript")),
                            "timestamp": " - ".join(filter(None, (evidence_timestamp, last_timestamp))),
                            "text": assignment_text,
                        },
                    }
                )
            continue

        if index + 1 < len(normalized_rows) and text.endswith("ทุก"):
            next_row, next_text = normalized_rows[index + 1]
            if next_text.startswith("ฝ่าย"):
                text += next_text
                next_timestamp = str(next_row.get("timestamp", ""))
                evidence_timestamp = " - ".join(filter(None, (evidence_timestamp, next_timestamp)))

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
                    "timestamp": evidence_timestamp,
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
