def format_timestamp(seconds: float) -> str:
    if seconds < 0:
        raise ValueError("seconds must be non-negative")

    total_milliseconds = round(seconds * 1000)
    milliseconds = total_milliseconds % 1000
    total_seconds = total_milliseconds // 1000
    hours, remainder = divmod(total_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)

    if milliseconds:
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}.{milliseconds:03d}"

    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


def format_time_range(start_seconds: float, end_seconds: float) -> str:
    if end_seconds < start_seconds:
        raise ValueError("end_seconds must be greater than or equal to start_seconds")

    return f"{format_timestamp(start_seconds)} - {format_timestamp(end_seconds)}"


if __name__ == "__main__":
    assert format_timestamp(0) == "00:00:00"
    assert format_timestamp(65.25) == "00:01:05.250"
    assert format_time_range(0, 90) == "00:00:00 - 00:01:30"
    print("timestamp self-check passed")
