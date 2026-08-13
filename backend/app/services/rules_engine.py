from typing import List, Dict, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models import (
    ScoreRecord, Subject, Student,
    WeakTopic, ClassComparison, ConsistencyFlag,
)

import math

def get_student_subject_averages(
    db: Session, student_id: int
) -> Dict[str, Tuple[float, int]]:
    records = (
        db.query(ScoreRecord, Subject.name)
        .join(Subject, ScoreRecord.subject_id == Subject.id)
        .filter(ScoreRecord.student_id == student_id)
        .all()
    )

    subject_scores: Dict[str, List[float]] = {}
    for record, subject_name in records:
        pct = (record.score / record.max_score) * 100
        subject_scores.setdefault(subject_name, []).append(pct)

    return {
        name: (sum(scores) / len(scores), len(scores))
        for name, scores in subject_scores.items()
    }

def detect_weak_topics(
    db: Session, student_id: int, threshold: float = 10.0
) -> List[WeakTopic]:
    subject_avgs = get_student_subject_averages(db, student_id)

    if not subject_avgs:
        return []

    all_avgs = [avg for avg, _ in subject_avgs.values()]
    overall_avg = sum(all_avgs) / len(all_avgs)

    weak = []
    for subject_name, (subj_avg, _) in subject_avgs.items():
        gap = subj_avg - overall_avg
        if gap < -threshold:
            weak.append(WeakTopic(
                subject_name=subject_name,
                subject_avg=round(subj_avg, 1),
                overall_avg=round(overall_avg, 1),
                gap=round(gap, 1),
            ))

    weak.sort(key=lambda w: w.gap)
    return weak

def compute_class_comparisons(
    db: Session, student_id: int
) -> List[ClassComparison]:
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        return []

    student_avgs = get_student_subject_averages(db, student_id)
    if not student_avgs:
        return []

    comparisons = []

    for subject_name, (student_avg, _) in student_avgs.items():
        subject = db.query(Subject).filter(Subject.name == subject_name).first()
        if not subject:
            continue

        classmates = (
            db.query(Student.id)
            .filter(Student.grade == student.grade)
            .all()
        )
        classmate_ids = [c.id for c in classmates]

        if not classmate_ids:
            continue

        classmate_avgs = []
        for cid in classmate_ids:
            records = (
                db.query(ScoreRecord)
                .filter(
                    ScoreRecord.student_id == cid,
                    ScoreRecord.subject_id == subject.id,
                )
                .all()
            )
            if records:
                avg = sum((r.score / r.max_score) * 100 for r in records) / len(records)
                classmate_avgs.append((cid, avg))

        if not classmate_avgs:
            continue

        class_avg = sum(a for _, a in classmate_avgs) / len(classmate_avgs)

        below = sum(1 for _, a in classmate_avgs if a < student_avg)
        percentile = (below / len(classmate_avgs)) * 100

        comparisons.append(ClassComparison(
            subject_name=subject_name,
            student_avg=round(student_avg, 1),
            class_avg=round(class_avg, 1),
            delta=round(student_avg - class_avg, 1),
            percentile=round(percentile, 1),
        ))

    return comparisons

def compute_consistency_flags(
    db: Session, student_id: int, volatility_threshold: float = 15.0
) -> List[ConsistencyFlag]:
    records = (
        db.query(ScoreRecord, Subject.name)
        .join(Subject, ScoreRecord.subject_id == Subject.id)
        .filter(ScoreRecord.student_id == student_id)
        .all()
    )

    subject_scores: Dict[str, List[float]] = {}
    for record, subject_name in records:
        pct = (record.score / record.max_score) * 100
        subject_scores.setdefault(subject_name, []).append(pct)

    flags = []
    for subject_name, scores in subject_scores.items():
        if len(scores) < 2:
            flags.append(ConsistencyFlag(
                subject_name=subject_name,
                std_dev=0.0,
                label="Insufficient Data",
            ))
            continue

        mean = sum(scores) / len(scores)
        variance = sum((s - mean) ** 2 for s in scores) / len(scores)
        std_dev = math.sqrt(variance)

        label = "Volatile" if std_dev > volatility_threshold else "Stable"
        flags.append(ConsistencyFlag(
            subject_name=subject_name,
            std_dev=round(std_dev, 1),
            label=label,
        ))

    return flags

def generate_summary(
    student_name: str,
    weak_topics: List[WeakTopic],
    comparisons: List[ClassComparison],
    consistency_flags: List[ConsistencyFlag],
) -> str:
    parts = []

    if comparisons:
        above = [c for c in comparisons if c.delta > 0]
        below = [c for c in comparisons if c.delta < 0]
        if len(above) > len(below):
            parts.append(
                f"{student_name} is performing above the class average "
                f"in {len(above)} out of {len(comparisons)} subjects."
            )
        elif len(below) > len(above):
            parts.append(
                f"{student_name} is performing below the class average "
                f"in {len(below)} out of {len(comparisons)} subjects."
            )
        else:
            parts.append(
                f"{student_name} is performing at roughly the class average "
                f"across subjects."
            )

    if weak_topics:
        topic_names = ", ".join(w.subject_name for w in weak_topics)
        worst = weak_topics[0]
        parts.append(
            f"Weak area{'s' if len(weak_topics) > 1 else ''}: {topic_names}. "
            f"{worst.subject_name} is the biggest concern at "
            f"{worst.subject_avg:.0f}% vs. an overall average of "
            f"{worst.overall_avg:.0f}% (gap: {worst.gap:+.0f}%)."
        )
    else:
        parts.append("No significant weak areas detected - well-rounded performance.")

    volatile = [f for f in consistency_flags if f.label == "Volatile"]
    if volatile:
        names = ", ".join(v.subject_name for v in volatile)
        parts.append(
            f"Inconsistent scores in {names} - consider regular practice "
            f"or test-prep support to stabilize performance."
        )

    return " ".join(parts)
