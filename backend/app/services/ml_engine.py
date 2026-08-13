from typing import List, Dict, Tuple, Optional
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.cluster import KMeans
from sqlalchemy.orm import Session

from ..models import (
    ScoreRecord, Subject, Student,
    TrendForecast, ClusterInfo,
)

def forecast_trends(
    db: Session, student_id: int
) -> List[TrendForecast]:
    records = (
        db.query(ScoreRecord, Subject.name)
        .join(Subject, ScoreRecord.subject_id == Subject.id)
        .filter(ScoreRecord.student_id == student_id)
        .order_by(ScoreRecord.date.asc())
        .all()
    )

    subject_scores: Dict[str, List[float]] = {}
    for record, subject_name in records:
        pct = (record.score / record.max_score) * 100
        subject_scores.setdefault(subject_name, []).append(pct)

    forecasts = []
    for subject_name, scores in subject_scores.items():
        n = len(scores)

        if n < 2:
            forecasts.append(TrendForecast(
                subject_name=subject_name,
                scores_used=n,
                predicted_next_score=round(scores[0], 1),
                slope=0.0,
                trend_label="Insufficient Data",
            ))
            continue

        X = np.arange(n).reshape(-1, 1)
        y = np.array(scores)

        model = LinearRegression()
        model.fit(X, y)

        predicted = model.predict(np.array([[n]]))[0]
        slope = model.coef_[0]

        predicted = max(0.0, min(100.0, predicted))

        if slope > 1.0:
            trend_label = "Improving"
        elif slope < -1.0:
            trend_label = "Declining"
        else:
            trend_label = "Flat"

        forecasts.append(TrendForecast(
            subject_name=subject_name,
            scores_used=n,
            predicted_next_score=round(predicted, 1),
            slope=round(slope, 2),
            trend_label=trend_label,
        ))

    return forecasts

def cluster_students(
    db: Session, target_student_id: int, n_clusters: int = 3
) -> Optional[ClusterInfo]:
    students = db.query(Student).all()
    if len(students) < n_clusters:
        return None

    student_features: Dict[int, Dict] = {}

    for student in students:
        records = (
            db.query(ScoreRecord, Subject.name)
            .join(Subject, ScoreRecord.subject_id == Subject.id)
            .filter(ScoreRecord.student_id == student.id)
            .order_by(ScoreRecord.date.asc())
            .all()
        )

        if not records:
            continue

        subject_scores: Dict[str, List[float]] = {}
        for record, subject_name in records:
            pct = (record.score / record.max_score) * 100
            subject_scores.setdefault(subject_name, []).append(pct)

        all_pcts = [pct for scores in subject_scores.values() for pct in scores]
        overall_avg = sum(all_pcts) / len(all_pcts)

        std_devs = []
        for scores in subject_scores.values():
            if len(scores) >= 2:
                mean = sum(scores) / len(scores)
                var = sum((s - mean) ** 2 for s in scores) / len(scores)
                std_devs.append(var ** 0.5)
        avg_std = sum(std_devs) / len(std_devs) if std_devs else 0.0

        slopes = []
        for scores in subject_scores.values():
            if len(scores) >= 2:
                X = np.arange(len(scores)).reshape(-1, 1)
                y = np.array(scores)
                model = LinearRegression()
                model.fit(X, y)
                slopes.append(model.coef_[0])
        avg_slope = sum(slopes) / len(slopes) if slopes else 0.0

        student_features[student.id] = {
            "overall_avg": overall_avg,
            "consistency": avg_std,
            "avg_slope": avg_slope,
        }

    if target_student_id not in student_features:
        return None

    student_ids = sorted(student_features.keys())
    X = np.array([
        [
            student_features[sid]["overall_avg"],
            student_features[sid]["consistency"],
            student_features[sid]["avg_slope"],
        ]
        for sid in student_ids
    ])

    actual_k = min(n_clusters, len(student_ids))
    kmeans = KMeans(n_clusters=actual_k, random_state=42, n_init=10)
    labels = kmeans.fit_predict(X)

    target_idx = student_ids.index(target_student_id)
    target_cluster = int(labels[target_idx])

    cluster_labels = _label_clusters(kmeans.cluster_centers_)

    return ClusterInfo(
        cluster_id=target_cluster,
        cluster_label=cluster_labels[target_cluster]["label"],
        description=cluster_labels[target_cluster]["description"],
    )

def _label_clusters(
    centroids: np.ndarray,
) -> Dict[int, Dict[str, str]]:
    # Note: centroids represent the cluster group's average characteristics, not the individual student's own.
    n = len(centroids)
    labels: Dict[int, Dict[str, str]] = {}

    avg_ranks = np.argsort(np.argsort(centroids[:, 0]))
    consistency_ranks = np.argsort(np.argsort(centroids[:, 1]))
    slope_ranks = np.argsort(np.argsort(centroids[:, 2]))

    for i in range(n):
        avg = centroids[i, 0]
        std = centroids[i, 1]
        slope = centroids[i, 2]

        if avg_ranks[i] == n - 1 and slope >= 0:
            label = "Steady Performer"
            desc = (
                f"Consistently high performance (avg ~{avg:.0f}%) with "
                f"{'improving' if slope > 1 else 'stable'} trends."
            )
        elif slope_ranks[i] == n - 1 and slope > 1:
            label = "Fast Improver"
            desc = (
                f"Scores are trending upward (slope: {slope:+.1f}/test). "
                f"Current average ~{avg:.0f}% but climbing."
            )
        elif avg_ranks[i] == 0:
            label = "Needs Support"
            desc = (
                f"Below-average performance (~{avg:.0f}%) - "
                f"{'declining' if slope < -1 else 'flat'} trend suggests "
                f"intervention would help."
            )
        elif consistency_ranks[i] == n - 1:
            label = "Inconsistent Performer"
            desc = (
                f"Higher score variance (results vary more than most students'). Average is "
                f"~{avg:.0f}% but results swing significantly between tests."
            )
        else:
            label = "Average Performer"
            desc = (
                f"Middle-of-the-pack performance (~{avg:.0f}%) with "
                f"{'slight improvement' if slope > 0 else 'stable'} trend."
            )

        labels[i] = {"label": label, "description": desc}

    return labels
