def build_query_summary_prompt(question: str, transcript_context: str) -> str:
    question = question.strip()
    transcript_context = transcript_context.strip()

    return "\n".join(
        [
            "Question:",
            question,
            "",
            "Relevant transcript:",
            transcript_context,
            "",
            "Instruction:",
            "สรุปคำตอบจากเนื้อหาการประชุมเป็นภาษาไทย โดยห้ามแต่งข้อมูลที่ไม่มีใน transcript",
        ]
    )


if __name__ == "__main__":
    prompt = build_query_summary_prompt("มติเรื่องงบประมาณคืออะไร", "ที่ประชุมมีมติให้ปรับแผนงบประมาณ")
    assert "Question:" in prompt
    assert "Relevant transcript:" in prompt
    assert "ห้ามแต่งข้อมูล" in prompt
    print("prompt self-check passed")
