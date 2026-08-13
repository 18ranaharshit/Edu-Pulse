from datetime import date
from typing import List, Optional

from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship

from .database import Base

class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    grade = Column(String, nullable=False)
    email = Column(String, nullable=True)
    is_mock = Column(Boolean, default=False, nullable=False)

    scores = relationship("ScoreRecord", back_populates="student")

class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)

    scores = relationship("ScoreRecord", back_populates="subject")

class ScoreRecord(Base):
    __tablename__ = "score_records"
    __table_args__ = (
        UniqueConstraint("student_id", "subject_id", "test_name", "date", name="uq_student_subject_test_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    score = Column(Float, nullable=False)
    max_score = Column(Float, nullable=False)
    test_name = Column(String, nullable=False)
    date = Column(Date, nullable=False)

    student = relationship("Student", back_populates="scores")
    subject = relationship("Subject", back_populates="scores")

class StudentBase(BaseModel):
    name: str
    grade: str
    email: Optional[str] = None
    is_mock: bool = False

class StudentCreate(StudentBase):
    pass

class StudentResponse(StudentBase):
    id: int
    is_mock: bool
    model_config = ConfigDict(from_attributes=True)

class SubjectResponse(BaseModel):
    id: int
    name: str
    model_config = ConfigDict(from_attributes=True)

class ClassAverageResponse(BaseModel):
    subject_id: int
    subject_name: str
    class_average: float
    num_students: int

class ScoreRecordBase(BaseModel):
    score: float = Field(ge=0, le=100)
    max_score: float = Field(gt=0)
    test_name: str
    date: date

class ScoreRecordCreate(ScoreRecordBase):
    subject_name: str

class ScoreRecordResponse(ScoreRecordBase):
    id: int
    student_id: int
    subject_id: int
    subject_name: str
    model_config = ConfigDict(from_attributes=True)

class CSVRowError(BaseModel):
    row_number: int
    error: str

class CSVUploadResponse(BaseModel):
    inserted: int
    updated: int = 0
    errors: List[CSVRowError]
    message: str

class WeakTopic(BaseModel):
    subject_name: str
    subject_avg: float
    overall_avg: float
    gap: float

class ClassComparison(BaseModel):
    subject_name: str
    student_avg: float
    class_avg: float
    delta: float
    percentile: float

class ConsistencyFlag(BaseModel):
    subject_name: str
    std_dev: float
    label: str

class TrendForecast(BaseModel):
    subject_name: str
    scores_used: int
    predicted_next_score: float
    slope: float
    trend_label: str

class ClusterInfo(BaseModel):
    cluster_id: int
    cluster_label: str
    description: str

class NextBestAction(BaseModel):
    subject_name: str
    priority_level: str
    reason: str
    current_avg: float
    class_avg: float
    predicted_next_score: float

class SubjectPriority(BaseModel):
    subject_name: str
    weakness_score: float
    decline_score: float
    combined_priority: float
    priority_level: str

class WhatIfResponse(BaseModel):
    subject_name: str
    current_subject_avg: float
    target_score: float
    current_overall_avg: float
    projected_overall_avg: float
    delta: float

class InsightsResponse(BaseModel):
    student_id: int
    student_name: str
    weak_topics: List[WeakTopic]
    class_comparisons: List[ClassComparison]
    consistency_flags: List[ConsistencyFlag]
    trend_forecasts: List[TrendForecast]
    cluster: Optional[ClusterInfo]
    next_best_action: Optional[NextBestAction] = None
    subject_priorities: List[SubjectPriority] = []
    summary: str
