from __future__ import annotations

import hashlib
from pathlib import Path
from PIL import Image, ImageDraw


DOCS = [
    {
        "stored_name": "11111111-1111-1111-1111-111111111111.pdf",
        "title": "Full Blood Count Report - 12 Mar 2026.pdf",
        "category": "Lab Results",
        "note": "Routine laboratory panel requested after annual primary care review.",
    },
    {
        "stored_name": "22222222-2222-2222-2222-222222222222.pdf",
        "title": "Specialist Referral Letter - Cardiology.pdf",
        "category": "Referral",
        "note": "Referral letter prepared for cardiology follow-up assessment.",
    },
    {
        "stored_name": "33333333-3333-3333-3333-333333333333.pdf",
        "title": "Chest X-Ray Summary - Follow-up.pdf",
        "category": "Imaging",
        "note": "Imaging summary uploaded after respiratory follow-up appointment.",
    },
    {
        "stored_name": "44444444-4444-4444-4444-444444444444.pdf",
        "title": "HbA1c Monitoring Result - 02 Apr 2026.pdf",
        "category": "Lab Results",
        "note": "Quarterly diabetes monitoring result uploaded for ongoing chronic care review.",
    },
    {
        "stored_name": "55555555-5555-5555-5555-555555555555.pdf",
        "title": "Discharge Summary - Community Hospital.pdf",
        "category": "General",
        "note": "Hospital discharge summary covering follow-up medication and care instructions.",
    },
    {
        "stored_name": "66666666-6666-6666-6666-666666666666.pdf",
        "title": "Respiratory Medication Review - May 2026.pdf",
        "category": "Prescription",
        "note": "Medication review notes uploaded to support ongoing respiratory treatment.",
    },
]


def wrap_text(text: str, width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""

    for word in words:
        candidate = word if not current else f"{current} {word}"
        if len(candidate) <= width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word

    if current:
        lines.append(current)

    return lines


def build_pdf(doc: dict[str, str], output_path: Path) -> tuple[int, str]:
    image = Image.new("RGB", (1240, 1754), "white")
    draw = ImageDraw.Draw(image)

    y = 90
    for line in [
        "HealthNexus Medical Record",
        "",
        f"Document: {doc['title']}",
        f"Category: {doc['category']}",
        "Status: Active",
        "",
        "Confidential patient document.",
        "Stored in protected application storage.",
        "Served only through authenticated routes.",
        "",
        "Clinical note:",
        *wrap_text(doc["note"], 70),
    ]:
        draw.text((90, y), line, fill="black")
        y += 58 if line == "HealthNexus Medical Record" else 42

    image.save(output_path, "PDF", resolution=150.0)
    pdf_bytes = output_path.read_bytes()
    sha256 = hashlib.sha256(pdf_bytes).hexdigest()
    return len(pdf_bytes), sha256


def main() -> None:
    upload_dir = Path("backend/uploads")
    upload_dir.mkdir(parents=True, exist_ok=True)

    for doc in DOCS:
        output_path = upload_dir / doc["stored_name"]
        size_bytes, sha256 = build_pdf(doc, output_path)
        print(f"{doc['stored_name']} size={size_bytes} sha256={sha256}")


if __name__ == "__main__":
    main()
