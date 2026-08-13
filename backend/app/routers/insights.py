from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models import (
    Student, Subject, ScoreRecord,
    InsightsResponse, SubjectResponse, ClassAverageResponse,
    WhatIfResponse,
)
from ..services.rules_engine import (
    detect_weak_topics,
    compute_class_comparisons,
    compute_consistency_flags,
    generate_summary,
    get_student_subject_averages,
)
from ..services.ml_engine import forecast_trends, cluster_students
from ..services.priority_engine import (
    compute_next_best_action,
    compute_subject_priorities,
)

router = APIRouter(tags=["insights"])

@router.get(
    "/students/{student_id}/insights",
    response_model=InsightsResponse,
)
def get_student_insights(student_id: int, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail=f"Student {student_id} not found.")

    score_count = (
        db.query(ScoreRecord)
        .filter(ScoreRecord.student_id == student_id)
        .count()
    )
    if score_count == 0:
        return InsightsResponse(
            student_id=student.id,
            student_name=student.name,
            weak_topics=[],
            class_comparisons=[],
            consistency_flags=[],
            trend_forecasts=[],
            cluster=None,
            next_best_action=None,
            subject_priorities=[],
            summary=f"{student.name} has no score records yet. Upload scores to get insights.",
        )

    weak_topics = detect_weak_topics(db, student_id)
    class_comparisons = compute_class_comparisons(db, student_id)
    consistency_flags = compute_consistency_flags(db, student_id)

    trend_forecasts = forecast_trends(db, student_id)
    cluster = cluster_students(db, student_id)

    # Priority Engine — compute Next Best Action and subject priorities
    next_best_action = compute_next_best_action(
        weak_topics, trend_forecasts, class_comparisons
    )
    subject_priorities = compute_subject_priorities(
        weak_topics, trend_forecasts, class_comparisons
    )

    summary = generate_summary(
        student.name, weak_topics, class_comparisons, consistency_flags
    )

    declining = [t for t in trend_forecasts if t.trend_label == "Declining"]
    improving = [t for t in trend_forecasts if t.trend_label == "Improving"]

    if declining:
        names = ", ".join(t.subject_name for t in declining)
        summary += (
            f" ML trend analysis shows declining performance in {names} - "
            f"early intervention recommended."
        )
    if improving:
        names = ", ".join(t.subject_name for t in improving)
        summary += f" Positive trend detected in {names} - keep it up!"

    if cluster:
        summary += f" Performance profile: {cluster.cluster_label}."

    return InsightsResponse(
        student_id=student.id,
        student_name=student.name,
        weak_topics=weak_topics,
        class_comparisons=class_comparisons,
        consistency_flags=consistency_flags,
        trend_forecasts=trend_forecasts,
        cluster=cluster,
        next_best_action=next_best_action,
        subject_priorities=subject_priorities,
        summary=summary,
    )


@router.get(
    "/students/{student_id}/what-if",
    response_model=WhatIfResponse,
)
def what_if_simulation(
    student_id: int,
    subject: str = Query(..., description="Subject name to simulate"),
    target_score: float = Query(..., ge=0, le=100, description="Target score (0-100)"),
    db: Session = Depends(get_db),
):
    """
    What-If Simulator: recompute the student's overall average if one
    subject's average were replaced with target_score, holding all
    other subjects' current averages constant.
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail=f"Student {student_id} not found.")

    subject_avgs = get_student_subject_averages(db, student_id)
    if not subject_avgs:
        raise HTTPException(status_code=400, detail="Student has no score records.")

    if subject not in subject_avgs:
        raise HTTPException(
            status_code=400,
            detail=f"Subject '{subject}' not found for this student. "
                   f"Available: {', '.join(sorted(subject_avgs.keys()))}",
        )

    current_subject_avg = subject_avgs[subject][0]

    all_avgs = [avg for avg, _ in subject_avgs.values()]
    current_overall_avg = sum(all_avgs) / len(all_avgs)

    # Replace the target subject's average and recompute
    projected_avgs = [
        target_score if name == subject else avg
        for name, (avg, _) in subject_avgs.items()
    ]
    projected_overall_avg = sum(projected_avgs) / len(projected_avgs)

    delta = projected_overall_avg - current_overall_avg

    return WhatIfResponse(
        subject_name=subject,
        current_subject_avg=round(current_subject_avg, 1),
        target_score=round(target_score, 1),
        current_overall_avg=round(current_overall_avg, 1),
        projected_overall_avg=round(projected_overall_avg, 1),
        delta=round(delta, 1),
    )


@router.get("/subjects", response_model=List[SubjectResponse])
def list_subjects(db: Session = Depends(get_db)):
    subjects = db.query(Subject).order_by(Subject.name).all()
    return subjects

@router.get(
    "/subjects/{subject_id}/class-average",
    response_model=ClassAverageResponse,
)
def get_class_average(subject_id: int, db: Session = Depends(get_db)):
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail=f"Subject {subject_id} not found.")

    records = (
        db.query(ScoreRecord)
        .filter(ScoreRecord.subject_id == subject_id)
        .all()
    )

    if not records:
        return ClassAverageResponse(
            subject_id=subject.id,
            subject_name=subject.name,
            class_average=0.0,
            num_students=0,
        )

    student_avgs = {}
    for record in records:
        pct = (record.score / record.max_score) * 100
        student_avgs.setdefault(record.student_id, []).append(pct)

    per_student = [sum(v) / len(v) for v in student_avgs.values()]
    class_avg = sum(per_student) / len(per_student) if per_student else 0.0

    return ClassAverageResponse(
        subject_id=subject.id,
        subject_name=subject.name,
        class_average=round(class_avg, 1),
        num_students=len(per_student),
    )
