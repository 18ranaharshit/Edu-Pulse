from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Student, StudentResponse

router = APIRouter(prefix="/students", tags=["students"])

@router.get("", response_model=List[StudentResponse])
def list_students(
    source: Optional[str] = Query(None, description="Filter by source: 'mock' or 'csv'"),
    db: Session = Depends(get_db)
):
    query = db.query(Student)
    if source == "mock":
        query = query.filter(Student.is_mock == True)
    elif source == "csv":
        query = query.filter(Student.is_mock == False)
    
    students = query.order_by(Student.name).all()
    return students

@router.get("/{student_id}", response_model=StudentResponse)
def get_student(student_id: int, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail=f"Student {student_id} not found.")
    return student
