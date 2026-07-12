import unittest

from src.summarization.action_items import extract_action_items


class ActionItemTest(unittest.TestCase):
    def test_extracts_natural_named_assignment_across_rows(self):
        rows = [
            {"timestamp": "transcript-07", "text": "ผมขอมอบหมายงานให้นัทสิทธิ์พีไปทำต่อนะครับ"},
            {"timestamp": "transcript-08", "text": "โดยมีข้อกำหนดสองอย่างคือหนึ่ง เขียนยูนิเทส"},
            {"timestamp": "transcript-09", "text": "สำหรับหน้าล็อกอิน และสอง พัฒนาระบบอัปโหลดไฟล์"},
            {"timestamp": "transcript-10", "text": "บนหน้าเวิร์คให้เรียบร้อย"},
            {"timestamp": "transcript-11", "text": "รบกวนส่งงานให้ผมตรวจภายในวันศุกร์นี้นะครับ"},
        ]
        items = extract_action_items(rows)
        self.assertEqual(len(items), 2)
        self.assertEqual([item["owner"] for item in items], ["นัทสิทธิ์พี", "นัทสิทธิ์พี"])
        self.assertIn("เขียนยูนิเทส", items[0]["task"])
        self.assertIn("พัฒนาระบบอัปโหลดไฟล์", items[1]["task"])
        self.assertEqual([item["deadline"] for item in items], ["วันศุกร์นี้", "วันศุกร์นี้"])

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
