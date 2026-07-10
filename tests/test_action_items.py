import unittest

from src.summarization.action_items import extract_action_items


class ActionItemTest(unittest.TestCase):
    def test_extracts_explicit_owner_task_deadline_and_evidence(self):
        rows = [
            {
                "timestamp": "00:00:21 - 00:00:29",
                "text": "ฝ่ายดำเนินงานต้องส่งเอกสารงบประมาณฉบับแก้ไขภายในวันศุกร์",
            }
        ]

        item = extract_action_items(rows)[0]

        self.assertEqual(item["owner"], "ฝ่ายดำเนินงาน")
        self.assertEqual(item["task"], "ส่งเอกสารงบประมาณฉบับแก้ไข")
        self.assertEqual(item["deadline"], "วันศุกร์")
        self.assertEqual(item["evidence"]["timestamp"], "00:00:21 - 00:00:29")
        self.assertFalse(item["approved"])

    def test_extracts_every_party_followup(self):
        rows = [
            {
                "timestamp": "transcript-05",
                "text": "ที่ประชุมพูดถึงความเสี่ยง และขอให้ทุก",
            },
            {"timestamp": "transcript-06", "text": "ฝ่าย ตรวจสอบข้อมูลก่อนส่งรายงาน"},
        ]

        item = extract_action_items(rows)[0]

        self.assertEqual(item["owner"], "ทุกฝ่าย")
        self.assertEqual(item["task"], "ตรวจสอบข้อมูล")
        self.assertEqual(item["deadline"], "ก่อนส่งรายงาน")
        self.assertEqual(item["evidence"]["timestamp"], "transcript-05 - transcript-06")
        self.assertIn("ขอให้ทุกฝ่าย ตรวจสอบข้อมูล", item["evidence"]["text"])

    def test_keeps_missing_deadline_empty(self):
        rows = [{"timestamp": "transcript-01", "text": "ทีมการเงินต้องตรวจสอบยอดเงิน"}]

        item = extract_action_items(rows)[0]

        self.assertIsNone(item["deadline"])

    def test_does_not_invent_action_from_general_discussion(self):
        rows = [{"timestamp": "transcript-01", "text": "ที่ประชุมพูดถึงความเสี่ยงเรื่องข้อมูลไม่ครบ"}]

        self.assertEqual(extract_action_items(rows), [])


if __name__ == "__main__":
    unittest.main()
