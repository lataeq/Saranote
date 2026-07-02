from src.asr.normalize_text import normalize_text


def test_normalize_basic():
    assert normalize_text("สวัสดีครับ") == "สวัสดีครับ"


def test_normalize_spaces():
    # Test whitespace stripping, collapsing, and normal space normalization
    assert normalize_text("  สวัสดี   ครับ  ") == "สวัสดี ครับ"
    assert normalize_text("สวัสดี\tครับ\nสบายดีไหม") == "สวัสดี ครับ สบายดีไหม"


def test_normalize_punctuation():
    # Test removal of Western punctuation
    assert normalize_text("สวัสดีครับ! สบายดีไหม?") == "สวัสดีครับ สบายดีไหม"
    assert normalize_text("สวัสดี (ครับ) - สบายดี/ไหม") == "สวัสดี ครับ สบายดี ไหม"
    assert normalize_text("Hello, World!") == "hello world"


def test_normalize_thai_specific():
    # Test that semantic Thai punctuation/symbols are kept:
    # - ๆ (maiyamok)
    # - ฯ (paiyannoi)
    # - ์ (silencing mark / garan)
    # - ๐-๙ (Thai digits)
    text = "เด็กๆ กำลังเดินทางไป กรุงเทพฯ วันนี้วันที่ ๑๒"
    assert normalize_text(text) == "เด็กๆ กำลังเดินทางไป กรุงเทพฯ วันนี้วันที่ ๑๒"


def test_normalize_case():
    assert normalize_text("Thai Speech to Text") == "thai speech to text"


def test_normalize_empty_and_none():
    assert normalize_text("") == ""
    assert normalize_text(None) == ""
