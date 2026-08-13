import csv
import io
from datetime import date, datetime
from typing import List, Tuple, Optional

from sqlalchemy.orm import Session

from ..models import ScoreRecord, Subject, Student, CSVRowError

REQUIRED_COLUMNS_SCORES_ONLY = {"subject", "score", "max_score", "test_name", "date"}

def parse_and_insert_csv(
    db: Session,
    file_content: str,
    default_student_id: Optional[int] = None,
) -> Tuple[int, int, List[CSVRowError]]:
    errors: List[CSVRowError] = []
    inserted = 0
    updated = 0

    try:
        reader = csv.DictReader(io.StringIO(file_content))
    except Exception as e:
        errors.append(CSVRowError(row_number=0, error=f"Failed to parse CSV: {str(e)}"))
        return 0, 0, errors

    if reader.fieldnames is None:
        errors.append(CSVRowError(row_number=0, error="CSV file is empty or has no headers."))
        return 0, 0, errors

    normalized_headers = {h.strip().lower() for h in reader.fieldnames}
    has_student_name = "student_name" in normalized_headers or "student" in normalized_headers or "name" in normalized_headers

    if not has_student_name and not default_student_id:
        errors.append(CSVRowError(
            row_number=0,
            error="CSV must contain a 'student_name' column.",
        ))
        return 0, 0, errors

    missing = REQUIRED_COLUMNS_SCORES_ONLY - normalized_headers
    if missing:
        errors.append(CSVRowError(
            row_number=0,
            error=f"Missing required columns: {', '.join(sorted(missing))}.",
        ))
        return 0, 0, errors

    for row_num, raw_row in enumerate(reader, start=2):
        row = {k.strip().lower(): v.strip() if v else "" for k, v in raw_row.items()}

        try:
            record, is_updated = _validate_and_build_record(db, row, row_num, default_student_id)
            if is_updated:
                updated += 1
            else:
                db.add(record)
                inserted += 1
        except ValueError as e:
            errors.append(CSVRowError(row_number=row_num, error=str(e)))

    if inserted > 0 or updated > 0:
        db.commit()

    return inserted, updated, errors

def _validate_and_build_record(
    db: Session,
    row: dict,
    row_num: int,
    default_student_id: Optional[int] = None,
) -> Tuple[ScoreRecord, bool]:
    student_name = row.get("student_name") or row.get("student") or row.get("name")
    student_id = default_student_id

    if student_name:
        student_name = student_name.strip()
        grade = row.get("grade", "10A").strip() or "10A"

        student = db.query(Student).filter(Student.name == student_name, Student.is_mock == False).first()
        if not student:
            student = Student(name=student_name, grade=grade, is_mock=False)
            db.add(student)
            db.flush()
        student_id = student.id
    elif not student_id:
        raise ValueError("Missing student name in row.")

    subject_name = row.get("subject", "").strip()
    if not subject_name:
        raise ValueError("Subject name is empty.")

    subject = db.query(Subject).filter(Subject.name == subject_name).first()
    if not subject:
        subject = Subject(name=subject_name)
        db.add(subject)
        db.flush()

    try:
        score = float(row.get("score", ""))
    except (ValueError, TypeError):
        raise ValueError(f"Invalid score value: '{row.get('score')}'.")
    if score < 0 or score > 100:
        raise ValueError(f"Score {score} is out of range (must be 0-100).")

    try:
        max_score = float(row.get("max_score", ""))
    except (ValueError, TypeError):
        raise ValueError(f"Invalid max_score value: '{row.get('max_score')}'.")
    if max_score <= 0:
        raise ValueError(f"max_score must be positive, got {max_score}.")
    if score > max_score:
        raise ValueError(f"Score ({score}) cannot exceed max_score ({max_score}).")

    test_name = row.get("test_name", "").strip()
    if not test_name:
        raise ValueError("Test name is empty.")

    date_str = row.get("date", "").strip()
    if not date_str:
        raise ValueError("Date is empty.")
    try:
        parsed_date = _parse_date(date_str)
    except ValueError:
        raise ValueError(
            f"Invalid date format: '{date_str}'. Expected YYYY-MM-DD, DD/MM/YYYY, or MM/DD/YYYY."
        )

    existing_record = db.query(ScoreRecord).filter(
        ScoreRecord.student_id == student_id,
        ScoreRecord.subject_id == subject.id,
        ScoreRecord.test_name == test_name,
        ScoreRecord.date == parsed_date,
    ).first()

    if existing_record:
        existing_record.score = score
        existing_record.max_score = max_score
        return existing_record, True

    return ScoreRecord(
        student_id=student_id,
        subject_id=subject.id,
        score=score,
        max_score=max_score,
        test_name=test_name,
        date=parsed_date,
    ), False

def _parse_date(date_str: str) -> date:
    formats = [
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%m/%d/%Y",
        "%d-%m-%Y",
        "%Y/%m/%d",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Could not parse date: {date_str}")
