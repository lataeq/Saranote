import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from zipfile import ZipFile

from src.documents.presentation import load_presentation


def _slide_xml(text: str) -> str:
    return (
        '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" '
        'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
        f"<p:cSld><a:t>{text}</a:t></p:cSld></p:sld>"
    )


class PresentationLoadingTest(unittest.TestCase):
    def test_loads_pptx_text_in_slide_order(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "budget.pptx"
            with ZipFile(path, "w") as archive:
                archive.writestr("ppt/slides/slide10.xml", _slide_xml("Action items"))
                archive.writestr("ppt/slides/slide2.xml", _slide_xml("Equipment budget"))

            rows = load_presentation(path)

        self.assertEqual([row["location"] for row in rows], ["slide-02", "slide-10"])
        self.assertEqual([row["text"] for row in rows], ["Equipment budget", "Action items"])
        self.assertEqual(rows[0]["filename"], "budget.pptx")

    @patch("src.documents.presentation.shutil.which", return_value="/usr/bin/pdftotext")
    @patch("src.documents.presentation.subprocess.run")
    def test_loads_pdf_text_by_page(self, run, _which):
        run.return_value = subprocess.CompletedProcess([], 0, "Budget plan\fTraining allocation\f", "")

        rows = load_presentation(Path("canva-export.pdf"))

        self.assertEqual([row["location"] for row in rows], ["page-01", "page-02"])
        self.assertEqual(rows[1]["text"], "Training allocation")
        run.assert_called_once_with(
            ["/usr/bin/pdftotext", "-layout", "canva-export.pdf", "-"],
            check=True,
            capture_output=True,
            text=True,
        )

    def test_rejects_unsupported_presentation_format(self):
        with self.assertRaisesRegex(ValueError, "pptx or .pdf"):
            load_presentation(Path("slides.key"))

    @patch("src.documents.presentation.shutil.which", return_value=None)
    def test_pdf_explains_missing_native_reader(self, _which):
        with self.assertRaisesRegex(RuntimeError, "Poppler pdftotext"):
            load_presentation(Path("slides.pdf"))


if __name__ == "__main__":
    unittest.main()
