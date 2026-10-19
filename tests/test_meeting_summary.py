import unittest

from src.summarization.meeting_summary import extract_meeting_summary


class MeetingSummaryTest(unittest.TestCase):
    def test_extracts_bounded_evidence_categories(self):
        rows = [
            {"text": "ที่ประชุมมีมติให้เปิดใช้งานระบบใหม่"},
            {"text": "ระบบยังไม่ได้เชื่อมต่อฐานข้อมูล"},
            {"text": "ทีมรายงานความคืบหน้าการพัฒนาหน้าล็อกอิน"},
        ]
        actions = [{"owner": "Nuttasit P", "task": "เขียนยูนิเทส", "deadline": "วันศุกร์"}]

        summary = extract_meeting_summary(rows, actions)

        self.assertEqual(summary["decisions"], ["ที่ประชุมมีมติให้เปิดใช้งานระบบใหม่"])
        self.assertEqual(summary["risks"], ["ระบบยังไม่ได้เชื่อมต่อฐานข้อมูล"])
        self.assertEqual(summary["important_points"], ["ทีมรายงานความคืบหน้าการพัฒนาหน้าล็อกอิน"])
        self.assertEqual(summary["follow_ups"], ["Nuttasit P: เขียนยูนิเทส (กำหนด วันศุกร์)"])

    def test_does_not_invent_missing_categories(self):
        summary = extract_meeting_summary([{"text": "กล่าวเปิดประชุม"}], [])
        self.assertEqual(summary, {"overview": "", "decisions": [], "risks": [], "important_points": [], "follow_ups": []})


if __name__ == "__main__":
    unittest.main()
