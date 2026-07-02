import re


def normalize_text(text: str) -> str:
    """
    Normalizes Thai/English text for fair ASR evaluation (WER/CER).

    Operations:
    1. Converts text to lowercase (primarily for English characters).
    2. Removes English and Thai punctuation/symbols, preserving letters, digits,
       whitespace, and semantic symbols like 'ๆ' and 'ฯ'.
    3. Collapses consecutive whitespace (spaces, tabs, newlines) into a single space.
    4. Strips leading and trailing whitespaces.

    Args:
        text (str): The raw input text.

    Returns:
        str: The normalized text.
    """
    if not isinstance(text, str):
        return ""

    # Convert to lowercase
    text = text.lower()

    # Remove punctuation and special characters, preserving:
    # - Thai characters: \u0e00-\u0e7f (includes letters, vowels, tones, ๆ, ฯ, and ๐-๙)
    # - English characters: a-z
    # - Numbers: 0-9
    # - Whitespaces: \s
    # Match any character that is NOT in the allowed set and replace with a space
    cleaned = re.sub(r"[^\u0e00-\u0e7fa-zA-Z0-9\s]", " ", text)


    # Replace any sequence of whitespace characters with a single space
    collapsed = re.sub(r"\s+", " ", cleaned)

    # Strip leading and trailing whitespace
    return collapsed.strip()
