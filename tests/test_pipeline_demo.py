import unittest

from src.pipeline.run_demo import run_demo_from_rows


CONFIG = {"max_chunk_characters": 35, "top_k": 1, "max_summary_points": 1}


class PipelineDemoTest(unittest.TestCase):
    def test_run_demo_includes_evidence_linked_action_items(self):
        rows = [
            {"timestamp": "transcript-01", "text": "ที่ประชุมมีมติให้ปรับแผนงบประมาณ"},
            {
                "timestamp": "transcript-02",
                "text": "ฝ่ายดำเนินงานต้องส่งเอกสารงบประมาณฉบับแก้ไขภายในวันศุกร์",
            },
        ]

        result = run_demo_from_rows(rows, "ที่ประชุมมีมติเรื่องงบประมาณอย่างไร", CONFIG)

        self.assertEqual(len(result["action_items"]), 1)
        self.assertEqual(result["action_items"][0]["owner"], "ฝ่ายดำเนินงาน")
        self.assertEqual(result["action_items"][0]["evidence"]["timestamp"], "transcript-02")
        self.assertFalse(result["action_items"][0]["approved"])

    def test_run_demo_expands_moderate_budget_match_to_next_chunk(self):
        rows = [
            {"timestamp": "transcript-01", "text": "เปิดประชุม"},
            {"timestamp": "transcript-02", "text": "ที่ประชุมมีมติให้ปรับแผนงบประมาณ โดยลดค่าใช้จ่าย"},
            {"timestamp": "transcript-03", "text": "ย้ายงบประมาณบางส่วนไปสนับสนุนงานอบรมทีมงาน"},
        ]

        result = run_demo_from_rows(rows, "ที่ประชุมมีมติเรื่องงบประมาณอย่างไร", CONFIG)

        self.assertIn("ลดค่าใช้จ่าย", result["answer"])
        self.assertIn("งานอบรมทีมงาน", result["answer"])
        self.assertNotIn("เปิดประชุม", result["answer"])

    def test_run_demo_does_not_expand_to_unrelated_next_chunk(self):
        rows = [
            {"timestamp": "transcript-01", "text": "ที่ประชุมมีมติให้ปรับแผนงบประมาณ"},
            {"timestamp": "transcript-02", "text": "ฝ่ายดำเนินงานต้องส่งเอกสารภายในวันศุกร์"},
        ]

        result = run_demo_from_rows(rows, "ที่ประชุมมีมติเรื่องงบประมาณอย่างไร", CONFIG)

        self.assertNotIn("ฝ่ายดำเนินงาน", result["answer"])

    def test_run_demo_repairs_split_every_party_context(self):
        rows = [
            {"timestamp": "transcript-05", "text": "ขอให้ทุก"},
            {"timestamp": "transcript-06", "text": "ฝ่าย ตรวจสอบข้อมูลก่อนส่งรายงาน"},
        ]

        result = run_demo_from_rows(rows, "ทุกฝ่ายต้องทำอะไรก่อนส่งรายงาน", CONFIG)

        self.assertIn("ทุกฝ่าย ตรวจสอบข้อมูลก่อนส่งรายงาน", result["answer"])
        self.assertEqual(result["action_items"][0]["owner"], "ทุกฝ่าย")
        self.assertEqual(result["action_items"][0]["task"], "ตรวจสอบข้อมูล")
        self.assertEqual(
            result["action_items"][0]["evidence"]["timestamp"],
            "transcript-05 - transcript-06",
        )


if __name__ == "__main__":
    unittest.main()
