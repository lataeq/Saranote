import argparse
import json
import os
import re
from pathlib import Path
from typing import Any

from src.documents.presentation import load_presentation
from src.retrieval.chunking import TranscriptChunk, chunk_transcript_rows
from src.retrieval.search import search_chunks
from src.summarization.action_items import extract_action_items
from src.summarization.meeting_summary import extract_meeting_summary
from src.summarization.summarize import summarize_from_context
from src.transcript.clean import clean_transcript_rows
from src.transcript.segment import split_audio
from src.transcript.timestamps import format_time_range


DEFAULT_CONFIG = {
    "asr_backend": "whisper",
    "model_name": "openai/whisper-small",
    "language": "thai",
    "task": "transcribe",
    "typhoon_model": "typhoon-asr-realtime",
    "typhoon_api_base_url": "https://api.opentyphoon.ai/v1",
    "typhoon_api_key_env": "TYPHOON_API_KEY",
    "gemini_model": "gemini-3.1-flash-lite",
    "gemini_api_key_env": "GEMINI_API_KEY",
    "sample_rate": 16000,
    "chunk_seconds": 10.0,
    "overlap_seconds": 0.0,
    "max_chunk_characters": 600,
    "top_k": 3,
    "max_summary_points": 3,
    "silence_threshold": 0.001,
}


TRANSCRIPT_BREAK_WORDS = {"นอกจากนี้", "อย่างไรก็ตาม", "ถัดไป"}
EXPAND_CONTEXT_BELOW_SCORE = 0.6
AUDIO_MIME_TYPES = {
    ".wav": "audio/wav",
    ".mp3": "audio/mp3",
    ".flac": "audio/flac",
    ".ogg": "audio/ogg",
    ".opus": "audio/opus",
}
SUMMARY_KEYS = ("decisions", "risks", "important_points")


DEMO_ROWS = [
    {"timestamp": "00:00:00 - 00:00:08", "text": "เปิดประชุม และแจ้งวาระวันนี้"},
    {"timestamp": "00:00:08 - 00:00:18", "text": "ที่ประชุม มีมติ ให้ปรับแผน งบประมาณ สำหรับโครงการใหม่"},
    {"timestamp": "00:00:18 - 00:00:28", "text": "ฝ่ายดำเนินงานต้องส่งเอกสารภายในวันศุกร์"},
]


def load_config(path: Path) -> dict[str, Any]:
    config = dict(DEFAULT_CONFIG)
    if not path.exists():
        return config

    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or ":" not in stripped:
            continue

        key, value = stripped.split(":", 1)
        config[key.strip()] = _parse_config_value(value.strip())

    return config


def run_demo_from_rows(
    rows: list[dict[str, Any]],
    question: str,
    config: dict[str, Any],
    presentation_rows: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    cleaned_rows = clean_transcript_rows(rows)
    chunks = chunk_transcript_rows(cleaned_rows, max_characters=int(config["max_chunk_characters"]))
    top_k = int(config["top_k"])
    search_results = search_chunks(question, chunks, top_k=top_k)
    retrieved_context = _expand_retrieved_context(question, search_results, chunks)
    for context in retrieved_context:
        context["source"] = "transcript"
        context["location"] = context["start_timestamp"]

    presentation_rows = presentation_rows or []
    presentation_chunks = [
        TranscriptChunk(index, row["location"], row["location"], row["text"], 1)
        for index, row in enumerate(presentation_rows, start=1)
    ]
    for result in search_chunks(question, presentation_chunks, top_k=top_k):
        row = presentation_rows[result.chunk.index - 1]
        retrieved_context.append(
            {
                "score": result.score,
                "matched_terms": result.matched_terms,
                "source": row["source"],
                "filename": row["filename"],
                "location": row["location"],
                "start_timestamp": row["location"],
                "end_timestamp": row["location"],
                "text": row["text"],
            }
        )

    ranked_context = sorted(retrieved_context, key=lambda context: -context["score"])
    retrieved_context = ranked_context[:top_k]
    if retrieved_context:
        cutoff_score = retrieved_context[-1]["score"]
        selected_sources = {context["source"] for context in retrieved_context}
        for context in ranked_context[top_k:]:
            if context["score"] != cutoff_score:
                break
            if context["source"] not in selected_sources:
                retrieved_context.append(context)
                selected_sources.add(context["source"])

    answer = summarize_from_context(
        question,
        [context["text"] for context in retrieved_context],
        max_points=int(config["max_summary_points"]),
    )
    if any(context["source"] == "presentation" for context in retrieved_context):
        answer = answer.replace("จาก transcript ที่เกี่ยวข้อง:", "จากหลักฐานที่เกี่ยวข้อง:", 1)

    return {
        "question": question,
        "answer": answer,
        "cleaned_rows": cleaned_rows,
        "retrieved_context": retrieved_context,
        "action_items": extract_action_items(cleaned_rows),
    }


def process_meeting_rows(
    rows: list[dict[str, Any]],
    config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    cleaned_rows = clean_transcript_rows(rows)
    gemini_summary = None
    if config and config.get("gemini_model"):
        cleaned_rows, gemini_summary = refine_meeting_with_gemini(cleaned_rows, config)
    action_items = extract_action_items(cleaned_rows)
    summary = extract_meeting_summary(cleaned_rows, action_items)
    if gemini_summary is not None:
        summary = {**gemini_summary, "follow_ups": summary["follow_ups"]}
    return {
        "cleaned_rows": cleaned_rows,
        "transcript": "\n".join(
            f"[{row['timestamp']}] {row['text']}" if row.get("timestamp") else str(row["text"])
            for row in cleaned_rows
        ),
        "action_items": action_items,
        "summary": summary,
    }


def refine_meeting_with_gemini(
    rows: list[dict[str, Any]],
    config: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, list[str]]]:
    import httpx

    api_key_env = str(config["gemini_api_key_env"])
    api_key = os.environ.get(api_key_env)
    if not api_key:
        raise SystemExit(f"Set {api_key_env} before using Gemini transcript refinement.")

    prompt = """แก้ไข transcript การประชุมภาษาไทยอย่างระมัดระวัง
- แก้เฉพาะคำผิดจาก ASR การเว้นวรรค และเครื่องหมายวรรคตอนโดยอาศัยบริบท
- รักษาความหมายเดิม ห้ามเพิ่ม ลบ สรุป หรือคาดเดาข้อมูล
- คง English technical terms เมื่อบริบทบ่งชี้ชัดเจน และห้ามประดิษฐ์ชื่อบุคคล
- คืน cleaned_rows ให้มีจำนวน ลำดับ และ timestamp ตรงกับ input ทุกประการ
- สร้าง summary ภาษาไทยจากข้อมูลที่ปรากฏจริงเท่านั้น ไม่เกินหมวดละ 4 ข้อ และใช้ [] เมื่อไม่มีข้อมูล

Transcript JSON:
""" + json.dumps(
        [{"timestamp": str(row.get("timestamp", "")), "text": str(row.get("text", ""))} for row in rows],
        ensure_ascii=False,
    )
    response = httpx.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{config['gemini_model']}:generateContent",
        headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
        json={
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseJsonSchema": _gemini_response_schema(),
            },
        },
        timeout=120,
    )
    if response.is_error:
        try:
            message = str(response.json().get("error", {}).get("message", ""))
        except (TypeError, ValueError):
            message = response.text
        raise RuntimeError(f"Gemini cleanup failed: {message or f'HTTP {response.status_code}'}")

    try:
        payload = response.json()
    except ValueError as error:
        raise RuntimeError("Gemini cleanup returned an invalid response.") from error
    return _parse_gemini_result(payload, rows)


def _gemini_response_schema() -> dict[str, Any]:
    summary_properties = {
        key: {"type": "array", "items": {"type": "string"}, "maxItems": 4}
        for key in SUMMARY_KEYS
    }
    return {
        "type": "object",
        "properties": {
            "cleaned_rows": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {"timestamp": {"type": "string"}, "text": {"type": "string"}},
                    "required": ["timestamp", "text"],
                    "additionalProperties": False,
                },
            },
            "summary": {
                "type": "object",
                "properties": summary_properties,
                "required": list(SUMMARY_KEYS),
                "additionalProperties": False,
            },
        },
        "required": ["cleaned_rows", "summary"],
        "additionalProperties": False,
    }


def _parse_gemini_result(
    payload: Any,
    source_rows: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, list[str]]]:
    try:
        parts = payload["candidates"][0]["content"]["parts"]
        result = json.loads(next(part["text"] for part in parts if isinstance(part.get("text"), str)))
        returned_rows = result["cleaned_rows"]
        returned_summary = result["summary"]
    except (KeyError, IndexError, StopIteration, TypeError, ValueError, json.JSONDecodeError) as error:
        raise RuntimeError("Gemini cleanup returned an invalid result.") from error

    if not isinstance(returned_rows, list) or len(returned_rows) != len(source_rows):
        raise RuntimeError("Gemini cleanup changed the transcript row count.")

    cleaned_rows = []
    for source, returned in zip(source_rows, returned_rows, strict=True):
        if not isinstance(returned, dict) or returned.get("timestamp") != str(source.get("timestamp", "")):
            raise RuntimeError("Gemini cleanup changed a transcript timestamp.")
        text = returned.get("text")
        if not isinstance(text, str) or not text.strip():
            raise RuntimeError("Gemini cleanup returned an empty transcript row.")
        cleaned_rows.append({**source, "text": text.strip()})

    if not isinstance(returned_summary, dict):
        raise RuntimeError("Gemini cleanup returned an invalid meeting summary.")
    summary = {}
    for key in SUMMARY_KEYS:
        items = returned_summary.get(key)
        if not isinstance(items, list) or len(items) > 4 or any(not isinstance(item, str) or not item.strip() for item in items):
            raise RuntimeError("Gemini cleanup returned an invalid meeting summary.")
        summary[key] = [item.strip() for item in items]
    return cleaned_rows, summary


def transcribe_audio(audio_path: Path, config: dict[str, Any]) -> list[dict[str, str]]:
    backend = str(config.get("asr_backend", "whisper"))
    if backend == "typhoon_api":
        return transcribe_audio_with_typhoon(audio_path, config)
    if backend != "whisper":
        raise SystemExit(f"Unknown ASR backend: {backend}")

    return transcribe_audio_with_whisper(audio_path, config)


def transcribe_audio_with_whisper(audio_path: Path, config: dict[str, Any]) -> list[dict[str, str]]:
    import librosa
    import torch
    from transformers import pipeline

    audio, sample_rate = librosa.load(audio_path, sr=int(config["sample_rate"]), mono=True)
    peak = float(abs(audio).max()) if len(audio) else 0.0
    if peak < float(config["silence_threshold"]):
        raise SystemExit(
            f"Audio appears silent (peak={peak:.6f}). Check microphone/input source and record again."
        )

    segments = split_audio(
        audio,
        sample_rate=sample_rate,
        chunk_seconds=float(config["chunk_seconds"]),
        overlap_seconds=float(config["overlap_seconds"]),
    )
    transcriber = pipeline(
        "automatic-speech-recognition",
        model=str(config["model_name"]),
        device=0 if torch.cuda.is_available() else -1,
        dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
    )

    rows = []
    generation_kwargs = {
        key: config[key]
        for key in ("language", "task")
        if config.get(key)
    }
    for segment in segments:
        prediction = transcriber({"array": segment.audio, "sampling_rate": sample_rate}, **generation_kwargs)
        text = prediction["text"] if isinstance(prediction, dict) else str(prediction)
        rows.append({"timestamp": format_time_range(segment.start_seconds, segment.end_seconds), "text": text})

    return rows


def transcribe_audio_with_typhoon(audio_path: Path, config: dict[str, Any]) -> list[dict[str, str]]:
    import httpx

    api_key_env = str(config["typhoon_api_key_env"])
    api_key = os.environ.get(api_key_env)
    if not api_key:
        raise SystemExit(f"Set {api_key_env} before using asr_backend=typhoon_api.")

    base_url = str(config["typhoon_api_base_url"]).rstrip("/")
    with audio_path.open("rb") as audio_file:
        response = httpx.post(
            f"{base_url}/audio/transcriptions",
            headers={"Authorization": f"Bearer {api_key}"},
            data={"model": str(config["typhoon_model"])},
            files={"file": (audio_path.name, audio_file, AUDIO_MIME_TYPES.get(audio_path.suffix.lower(), "application/octet-stream"))},
            timeout=120,
        )
    if response.is_error:
        try:
            message = str(response.json().get("error", {}).get("message", ""))
        except (TypeError, ValueError):
            message = response.text
        raise RuntimeError(f"Typhoon ASR failed: {message or f'HTTP {response.status_code}'}")

    payload = response.json()
    text = payload.get("text", "") if isinstance(payload, dict) else str(payload)
    return _rows_from_transcript_text(text, max_characters=int(config["max_chunk_characters"]))


def _parse_config_value(value: str) -> Any:
    if value.lower() in {"true", "false"}:
        return value.lower() == "true"
    try:
        return int(value)
    except ValueError:
        pass
    try:
        return float(value)
    except ValueError:
        return value.strip("\"'")


def _expand_retrieved_context(question: str, search_results: list[Any], chunks: list[Any]) -> list[dict[str, Any]]:
    expanded = []

    for result in search_results:
        position = result.chunk.index - 1
        start = position
        end = position

        if result.score < EXPAND_CONTEXT_BELOW_SCORE:
            if position < len(chunks) - 1 and _has_query_fragment(question, chunks[position + 1].text):
                end = position + 1
            split_every_party = (
                position
                and chunks[position - 1].text.rstrip().endswith("ทุก")
                and result.chunk.text.startswith("ฝ่าย")
            )
            if split_every_party:
                start = position - 1

        context_chunks = chunks[start : end + 1]
        expanded.append(
            {
                "score": result.score,
                "matched_terms": result.matched_terms,
                "start_timestamp": context_chunks[0].start_timestamp,
                "end_timestamp": context_chunks[-1].end_timestamp,
                "text": _join_context_chunks(context_chunks),
            }
        )

    return expanded


def _has_query_fragment(question: str, text: str, size: int = 4) -> bool:
    compact_question = re.sub(r"[^0-9a-zA-Z\u0e00-\u0e7f]+", "", question.lower())
    compact_text = re.sub(r"[^0-9a-zA-Z\u0e00-\u0e7f]+", "", text.lower())
    if len(compact_question) < size:
        return compact_question in compact_text

    return any(
        compact_question[index : index + size] in compact_text
        for index in range(len(compact_question) - size + 1)
    )


def _join_context_chunks(chunks: list[Any]) -> str:
    parts = []

    for chunk in chunks:
        for line in chunk.text.splitlines():
            if parts and parts[-1].endswith("ทุก") and line.startswith("ฝ่าย"):
                parts[-1] += line
            else:
                parts.append(line)

    return " ".join(parts)


def _rows_from_transcript_text(text: str, max_characters: int) -> list[dict[str, str]]:
    words = text.split()
    if not words:
        return []

    rows = []
    current = []
    current_length = 0

    for word in words:
        if current and word in TRANSCRIPT_BREAK_WORDS:
            rows.append({"timestamp": f"transcript-{len(rows) + 1:02d}", "text": " ".join(current)})
            current = []
            current_length = 0

        next_length = current_length + len(word) + (1 if current else 0)
        if current and next_length > max_characters:
            rows.append({"timestamp": f"transcript-{len(rows) + 1:02d}", "text": " ".join(current)})
            current = []
            current_length = 0

        current.append(word)
        current_length += len(word) + (1 if len(current) > 1 else 0)

    if current:
        rows.append({"timestamp": f"transcript-{len(rows) + 1:02d}", "text": " ".join(current)})

    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the ThaiMeetScribe final demo.")
    parser.add_argument("--audio", type=Path, help="Path to a meeting audio file.")
    parser.add_argument("--presentation", type=Path, help="Optional PPTX or PDF meeting presentation.")
    parser.add_argument("--question", help="Question to answer from meeting evidence.")
    parser.add_argument("--config", type=Path, default=Path("configs/final_demo.yaml"))
    parser.add_argument("--demo", action="store_true", help="Run the pipeline with built-in sample transcript rows.")
    parser.add_argument("--process", action="store_true", help="Return cleaned transcript and detected action items for the web app.")
    args = parser.parse_args()

    config = load_config(args.config)
    if args.demo:
        rows = DEMO_ROWS
    elif args.audio:
        rows = transcribe_audio(args.audio, config)
    else:
        raise SystemExit("Provide --audio path/to/audio.wav or use --demo for the built-in sample.")

    if args.process:
        result = process_meeting_rows(rows, config)
    else:
        if not args.question:
            raise SystemExit("Provide --question unless --process is used.")
        presentation_rows = load_presentation(args.presentation) if args.presentation else None
        result = run_demo_from_rows(rows, args.question, config, presentation_rows)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    assert AUDIO_MIME_TYPES[".mp3"] == "audio/mp3"
    assert _rows_from_transcript_text("หนึ่ง สอง สาม สี่", max_characters=9) == [
        {"timestamp": "transcript-01", "text": "หนึ่ง สอง"},
        {"timestamp": "transcript-02", "text": "สาม สี่"},
    ]
    assert _rows_from_transcript_text(
        "ฝ่ายดำเนินงานต้องส่งเอกสารงบประมาณฉบับแก้ไขภายในวันศุกร์ นอกจากนี้ ที่ประชุมพูดถึงความเสี่ยง",
        max_characters=70,
    ) == [
        {"timestamp": "transcript-01", "text": "ฝ่ายดำเนินงานต้องส่งเอกสารงบประมาณฉบับแก้ไขภายในวันศุกร์"},
        {"timestamp": "transcript-02", "text": "นอกจากนี้ ที่ประชุมพูดถึงความเสี่ยง"},
    ]
    assert run_demo_from_rows(
        [
            {"timestamp": "transcript-01", "text": "ที่ประชุมมีมติให้ปรับแผนงบประมาณ โดยลดค่าใช้จ่าย"},
            {"timestamp": "transcript-02", "text": "ย้ายงบประมาณบางส่วนไปสนับสนุนงานอบรมทีมงาน"},
        ],
        "ที่ประชุมมีมติเรื่องงบประมาณอย่างไร",
        {"max_chunk_characters": 70, "top_k": 1, "max_summary_points": 1},
    )["retrieved_context"][0]["end_timestamp"] == "transcript-02"
    main()
