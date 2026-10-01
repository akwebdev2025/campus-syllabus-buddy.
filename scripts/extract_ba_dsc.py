from pathlib import Path
from pypdf import PdfReader
import json
import re


SOURCE_DIR = Path("data/source-pdfs")
OUTPUT_DIR = Path("data/syllabus/ba")
OUTPUT_FILE = OUTPUT_DIR / "dsc.json"


def clean_text(text):
    text = text.replace("\x00", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_pdf(path):
    print(f"Reading {path}...")

    reader = PdfReader(str(path))

    pages = []

    for number, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""

        pages.append({
            "page": number,
            "text": clean_text(text)
        })

    print(f"  Pages: {len(pages)}")

    return pages


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    pdfs = sorted(SOURCE_DIR.glob("ba-dsc-*.pdf"))

    if not pdfs:
        raise SystemExit("No BA DSC PDFs found.")

    documents = []

    for pdf in pdfs:
        pages = extract_pdf(pdf)

        documents.append({
            "source_file": pdf.name,
            "pages": pages
        })

    output = {
        "metadata": {
            "university": "Panjab University, Chandigarh",
            "programme": "B.A./B.A. (Hons)/B.A. (Hons with Research)",
            "category": "Discipline Specific Core (DSC)",
            "session": "2026-27",
            "source": "Official Panjab University syllabus PDFs"
        },
        "documents": documents
    }

    with OUTPUT_FILE.open("w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print()
    print(f"Created: {OUTPUT_FILE}")
    print(f"Documents: {len(documents)}")


if __name__ == "__main__":
    main()
