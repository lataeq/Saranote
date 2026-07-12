import unittest

from src.pipeline.run_demo import AUDIO_MIME_TYPES, process_meeting_rows, run_demo_from_rows


CONFIG = {"max_chunk_characters": 35, "top_k": 1, "max_summary_points": 1}


class PipelineDemoTest(unittest.TestCase):
    def test_typhoon_uses_api_accepted_mp3_mime_type(self):
        self.assertEqual(AUDIO_MIME_TYPES[".mp3"], "audio/mp3")

    def test_process_meeting_rows_returns_transcript_and_detected_actions(self):
        result = process_meeting_rows([
            {"timestamp": "transcript-01", "text": "ฝ่ายขายต้องส่งรายงานภายในวันศุกร์"},
        ])
        self.assertIn("ฝ่ายขายต้องส่งรายงานภายในวันศุกร์", result["transcript"])
        self.assertEqual(result["action_items"][0]["owner"], "ฝ่ายขาย")

    def test_run_demo_retrieves_presentation_with_source_citation(self):
        rows = [{"timestamp": "transcript-01", "text": "ที่ประชุมหารือแผนงานทั่วไป"}]
        presentation_rows = [
            {
                "source": "presentation",
                "filename": "meeting.pdf",
                "location": "page-02",
                "text": "ย้ายงบประมาณบางส่วนไปสนับสนุนงานอบรมทีมงาน",
            },
            {
                "source": "presentation",
                "filename": "meeting.pdf",
                "location": "page-03",
                "text": "ฝ่ายดำเนินงานต้องส่งเอกสารภายในวันศุกร์",
            },
        ]

        result = run_demo_from_rows(
            rows,
            "ย้ายงบประมาณไปสนับสนุนอะไร",
            CONFIG,
            presentation_rows,
        )

        self.assertEqual(result["retrieved_context"][0]["source"], "presentation")
        self.assertEqual(result["retrieved_context"][0]["filename"], "meeting.pdf")
        self.assertEqual(result["retrieved_context"][0]["location"], "page-02")
        self.assertIn("งานอบรมทีมงาน", result["answer"])
        self.assertEqual(result["action_items"], [])

    def test_run_demo_keeps_tied_evidence_from_each_source(self):
        rows = [
            {
                "timestamp": "transcript-03",
                "text": "ด้านอุปกรณ์และย้ายงบประมาณบางส่วน ไปสนับสนุน งานอบรมทีมงาน",
            }
        ]
        presentation_rows = [
            {
                "source": "presentation",
                "filename": "meeting.pptx",
                "location": "slide-02",
                "text": (
                    "มติที่ประชุม ที่ประชุมปรับงบเพื่อให้งานอบรมเดินหน้า 01 ลดค่าใช้จ่าย ด้านอุปกรณ์ "
                    "02 ย้ายงบประมาณ บางส่วน 03 สนับสนุน งานอบรมทีมงาน ข้อสรุป "
                    "ลดงบอุปกรณ์และโยกงบบางส่วนไปสนับสนุนการพัฒนาทีม"
                ),
            }
        ]

        result = run_demo_from_rows(
            rows,
            "ย้ายงบประมาณไปสนับสนุนอะไร",
            CONFIG,
            presentation_rows,
        )

        self.assertEqual([item["source"] for item in result["retrieved_context"]], ["transcript", "presentation"])
        self.assertEqual([item["location"] for item in result["retrieved_context"]], ["transcript-03", "slide-02"])
        self.assertEqual(result["retrieved_context"][0]["score"], result["retrieved_context"][1]["score"])

    def test_run_demo_does_not_keep_weaker_second_source(self):
        rows = [{"timestamp": "transcript-01", "text": "งบประมาณสำหรับงานอบรม"}]
        presentation_rows = [
            {
                "source": "presentation",
                "filename": "meeting.pdf",
                "location": "page-01",
                "text": "งบประมาณสำหรับอุปกรณ์",
            }
        ]

        result = run_demo_from_rows(rows, "งบประมาณ งานอบรม", CONFIG, presentation_rows)

        self.assertEqual(len(result["retrieved_context"]), 1)
        self.assertEqual(result["retrieved_context"][0]["source"], "transcript")

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
