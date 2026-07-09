import unittest

from src.retrieval.chunking import chunk_transcript_rows
from src.retrieval.search import search_chunks


class RetrievalTest(unittest.TestCase):
    def test_chunk_transcript_rows_preserves_time_range(self):
        rows = [
            {"timestamp": "00:00:00 - 00:00:05", "text": "เปิดประชุม"},
            {"timestamp": "00:00:05 - 00:00:10", "text": "หารืองบประมาณ"},
            {"timestamp": "00:00:10 - 00:00:15", "text": "ปิดประชุม"},
        ]

        chunks = chunk_transcript_rows(rows, max_characters=25)

        self.assertEqual(len(chunks), 2)
        self.assertEqual(chunks[0].start_timestamp, "00:00:00 - 00:00:05")
        self.assertEqual(chunks[0].end_timestamp, "00:00:05 - 00:00:10")
        self.assertEqual(chunks[0].row_count, 2)

    def test_chunk_transcript_rows_skips_empty_rows(self):
        rows = [
            {"timestamp": "00:00:00 - 00:00:05", "text": ""},
            {"timestamp": "00:00:05 - 00:00:10", "text": "มีมติเห็นชอบ"},
        ]

        chunks = chunk_transcript_rows(rows, max_characters=20)

        self.assertEqual(len(chunks), 1)
        self.assertEqual(chunks[0].text, "มีมติเห็นชอบ")

    def test_chunk_transcript_rows_rejects_bad_size(self):
        with self.assertRaises(ValueError):
            chunk_transcript_rows([], max_characters=0)

    def test_search_chunks_returns_relevant_chunk(self):
        rows = [
            {"timestamp": "00:00:00 - 00:00:05", "text": "เปิดประชุม"},
            {"timestamp": "00:00:05 - 00:00:10", "text": "ที่ประชุมมีมติเรื่องงบประมาณ"},
        ]
        chunks = chunk_transcript_rows(rows, max_characters=20)

        results = search_chunks("งบประมาณ", chunks)

        self.assertEqual(results[0].chunk.text, "ที่ประชุมมีมติเรื่องงบประมาณ")

    def test_search_chunks_handles_unspaced_question(self):
        rows = [{"timestamp": "00:00:00 - 00:00:05", "text": "ที่ประชุมมีมติเรื่องงบประมาณ"}]
        chunks = chunk_transcript_rows(rows)

        results = search_chunks("ที่ประชุมสรุปเรื่องงบประมาณอย่างไร", chunks)

        self.assertEqual(results[0].chunk.text, "ที่ประชุมมีมติเรื่องงบประมาณ")


if __name__ == "__main__":
    unittest.main()
