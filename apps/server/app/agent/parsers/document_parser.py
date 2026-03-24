"""Document parser — extracts text from PDF, Markdown, Word, and plain text files."""

from pathlib import Path

from app.agent.parsers.base import BaseParser, ParseResult


class DocumentParser(BaseParser):
    async def parse(self, file_path: Path) -> ParseResult:
        ext = file_path.suffix.lower().lstrip(".")

        if ext == "pdf":
            text = self._parse_pdf(file_path)
        elif ext == "docx":
            text = self._parse_docx(file_path)
        elif ext in ("md", "markdown", "txt", "text"):
            text = file_path.read_text(encoding="utf-8", errors="replace")
        else:
            text = file_path.read_text(encoding="utf-8", errors="replace")

        return ParseResult(
            file_type=ext,
            text_content=text if text else None,
            metadata={"char_count": len(text) if text else 0},
        )

    @staticmethod
    def _parse_pdf(file_path: Path) -> str:
        try:
            import fitz  # pymupdf

            doc = fitz.open(str(file_path))
            pages_text = []
            for page in doc:
                pages_text.append(page.get_text())
            doc.close()
            text = "\n".join(pages_text).strip()
            if not text:
                raise ValueError("PDF contains no extractable text (possibly a scanned document)")
            return text
        except ImportError:
            return file_path.read_text(encoding="utf-8", errors="replace")

    @staticmethod
    def _parse_docx(file_path: Path) -> str:
        try:
            import docx

            doc = docx.Document(str(file_path))
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            return "\n".join(paragraphs)
        except ImportError:
            raise ValueError(
                "python-docx is required to parse DOCX files. Install with: uv add python-docx"
            )
