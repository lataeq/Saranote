import unittest

from src.transcript.clean import clean_transcript_rows, clean_transcript_text


class TranscriptCleaningTest(unittest.TestCase):
    def test_clean_transcript_text_collapses_whitespace(self):
        self.assertEqual(clean_transcript_text("  สวัสดี   ครับ\nทุกคน  "), "สวัสดี ครับ ทุกคน")

    def test_clean_transcript_text_trims_repeated_tokens(self):
        self.assertEqual(
            clean_transcript_text("ครับ ครับ ครับ ครับ", max_token_repeats=2),
            "ครับ ครับ",
        )

    def test_clean_transcript_text_keeps_non_adjacent_repeats(self):
        self.assertEqual(clean_transcript_text("มติ เห็นชอบ มติ"), "มติ เห็นชอบ มติ")

    def test_clean_transcript_text_rejects_invalid_repeat_limit(self):
        with self.assertRaises(ValueError):
            clean_transcript_text("สวัสดี", max_token_repeats=0)

    def test_clean_transcript_rows_removes_empty_rows_and_preserves_metadata(self):
        rows = [
            {"timestamp": "00:00:00 - 00:00:05", "speaker": "S1", "text": "  สวัสดี   ครับ  "},
            {"timestamp": "00:00:05 - 00:00:10", "speaker": "S2", "text": "   "},
        ]

        self.assertEqual(
            clean_transcript_rows(rows),
            [{"timestamp": "00:00:00 - 00:00:05", "speaker": "S1", "text": "สวัสดี ครับ"}],
        )


if __name__ == "__main__":
    unittest.main()
