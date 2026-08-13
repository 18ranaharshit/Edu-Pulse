from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    ScoreRecord, Subject, Student,
    ScoreRecordResponse, CSVUploadResponse,
)
from ..services.csv_parser import parse_and_insert_csv

MAX_CSV_SIZE_BYTES = 5 * 1024 * 1024  # 5MB

router = APIRouter(tags=["scores"])

@router.get(
    "/students/{student_id}/scores",
    response_model=List[ScoreRecordResponse],
)
def get_student_scores(student_id: int, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail=f"Student {student_id} not found.")

    records = (
        db.query(ScoreRecord)
        .filter(ScoreRecord.student_id == student_id)
        .order_by(ScoreRecord.date.asc())
        .all()
    )

    result = []
    for record in records:
        subject = db.query(Subject).filter(Subject.id == record.subject_id).first()
        result.append(ScoreRecordResponse(
            id=record.id,
            student_id=record.student_id,
            subject_id=record.subject_id,
            subject_name=subject.name if subject else "Unknown",
            score=record.score,
            max_score=record.max_score,
            test_name=record.test_name,
            date=record.date,
        ))

    return result

@router.post(
    "/scores/upload-csv",
    response_model=CSVUploadResponse,
)
async def upload_global_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    return await _process_csv_upload(db, file, default_student_id=None)

@router.post(
    "/students/{student_id}/scores/upload-csv",
    response_model=CSVUploadResponse,
)
async def upload_student_csv(
    student_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    return await _process_csv_upload(db, file, default_student_id=student_id)

async def _process_csv_upload(db: Session, file: UploadFile, default_student_id: Optional[int]):
    if file.filename and not file.filename.lower().endswith(".csv"):
        return CSVUploadResponse(
            inserted=0,
            errors=[],
            message="File must be a .csv file.",
        )

    try:
        content_bytes = await file.read()
        if len(content_bytes) > MAX_CSV_SIZE_BYTES:
            return CSVUploadResponse(
                inserted=0,
                updated=0,
                errors=[],
                message="File exceeds 5MB limit.",
            )
        content = content_bytes.decode("utf-8")
    except UnicodeDecodeError:
        return CSVUploadResponse(
            inserted=0,
            errors=[],
            message="File is not valid UTF-8 text.",
        )

    if not content.strip():
        return CSVUploadResponse(
            inserted=0,
            errors=[],
            message="CSV file is empty.",
        )

    inserted, updated, errors = parse_and_insert_csv(db, content, default_student_id)

    total_processed = inserted + updated
    if errors and total_processed == 0:
        message = f"No rows processed. {len(errors)} error(s) found."
    elif errors:
        message = f"Partially successful: {inserted} inserted, {updated} updated, {len(errors)} error(s)."
    else:
        message = f"Success: {inserted} inserted, {updated} updated."

    return CSVUploadResponse(
        inserted=inserted,
        updated=updated,
        errors=errors,
        message=message,
    )
