import re
import shutil
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZipFile


DRAWING_TEXT = "{http://schemas.openxmlformats.org/drawingml/2006/main}t"


def load_presentation(path: Path) -> list[dict[str, str]]:
    suffix = path.suffix.lower()
    if suffix == ".pptx":
        return _load_pptx(path)
    if suffix == ".pdf":
        return _load_pdf(path)
    raise ValueError("Presentation must be a .pptx or .pdf file")


def _load_pptx(path: Path) -> list[dict[str, str]]:
    with ZipFile(path) as archive:
        slide_names = sorted(
            (
                name
                for name in archive.namelist()
                if re.fullmatch(r"ppt/slides/slide\d+\.xml", name)
            ),
            key=lambda name: int(re.search(r"\d+", Path(name).stem).group()),
        )
        rows = []
        for name in slide_names:
            text = " ".join(
                node.text.strip()
                for node in ET.fromstring(archive.read(name)).iter(DRAWING_TEXT)
                if node.text and node.text.strip()
            )
            if text:
                number = int(re.search(r"\d+", Path(name).stem).group())
                rows.append(
                    {
                        "source": "presentation",
                        "filename": path.name,
                        "location": f"slide-{number:02d}",
                        "text": text,
                    }
                )

    # ponytail: numeric slide XML order; use python-pptx if reordered-deck support becomes necessary.
    return rows


def _load_pdf(path: Path) -> list[dict[str, str]]:
    pdftotext = shutil.which("pdftotext")
    if not pdftotext:
        raise RuntimeError("Install Poppler pdftotext to read PDF presentations")

    result = subprocess.run(
        [pdftotext, "-layout", str(path), "-"],
        check=True,
        capture_output=True,
        text=True,
    )
    return _evidence_rows(path.name, "page", result.stdout.split("\f"))


def _evidence_rows(filename: str, location_type: str, pages: list[str]) -> list[dict[str, str]]:
    rows = []
    for number, page in enumerate(pages, start=1):
        text = " ".join(page.split())
        if text:
            rows.append(
                {
                    "source": "presentation",
                    "filename": filename,
                    "location": f"{location_type}-{number:02d}",
                    "text": text,
                }
            )
    return rows


if __name__ == "__main__":
    assert _evidence_rows("slides.pdf", "page", ["Budget plan", "", "Action items"])[1] == {
        "source": "presentation",
        "filename": "slides.pdf",
        "location": "page-03",
        "text": "Action items",
    }
    print("presentation loader self-check passed")
