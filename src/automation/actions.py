from collections.abc import Iterable, Mapping
from typing import Any


def prepare_action_payloads(action_items: Iterable[Mapping[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    ready = []
    blocked = []

    for item in action_items:
        owner = str(item.get("owner", "")).strip()
        task = str(item.get("task", "")).strip()
        reason = None
        if item.get("approved") is not True:
            reason = "needs_approval"
        elif not owner:
            reason = "unassigned"
        elif not task:
            reason = "missing_task"

        if reason:
            blocked.append(
                {
                    "owner": owner or "unassigned",
                    "task": task,
                    "deadline": item.get("deadline"),
                    "reason": reason,
                    "evidence": dict(item.get("evidence") or {}),
                }
            )
            continue

        ready.append(
            {
                "event": "meeting.action_assigned",
                "owner": owner,
                "task": task,
                "deadline": item.get("deadline"),
                "evidence": dict(item.get("evidence") or {}),
            }
        )

    return {"ready": ready, "blocked": blocked}


if __name__ == "__main__":
    result = prepare_action_payloads(
        [
            {"owner": "ฝ่ายดำเนินงาน", "task": "ส่งเอกสาร", "approved": False},
            {"owner": "ทุกฝ่าย", "task": "ตรวจสอบข้อมูล", "approved": True},
        ]
    )
    assert len(result["ready"]) == 1
    assert result["blocked"][0]["reason"] == "needs_approval"
    print("action payload self-check passed")
