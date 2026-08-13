"""
Priority Engine — ranks subjects by combined weakness + decline score
to determine the student's "Next Best Action" focus area.

Weight rationale (defensible to judges):
  - weakness_score (0.6): Current gap below overall average is the most
    immediate, observable deficit — it's data the student can act on now.
  - decline_score (0.4): A negative trend slope warns of future risk, but
    slopes are predictions from LinearRegression and carry more uncertainty
    than a raw average gap.

Priority bands:
  - High  (combined >= 10): Urgent focus needed
  - Medium (combined >= 4): Worth attention
  - Low   (combined < 4):  Maintaining or minor concern
"""

from typing import List, Optional, Dict
from ..models import (
    WeakTopic, ClassComparison, TrendForecast,
    NextBestAction, SubjectPriority,
)

WEAKNESS_WEIGHT = 0.6
DECLINE_WEIGHT = 0.4

HIGH_THRESHOLD = 10.0
MEDIUM_THRESHOLD = 4.0


def compute_subject_priorities(
    weak_topics: List[WeakTopic],
    trend_forecasts: List[TrendForecast],
    class_comparisons: List[ClassComparison],
) -> List[SubjectPriority]:
    """Score every subject by combined weakness + decline priority."""

    # Build lookup maps from existing insights data
    weakness_by_subject: Dict[str, float] = {
        wt.subject_name: abs(wt.gap) for wt in weak_topics
    }

    slope_by_subject: Dict[str, float] = {
        tf.subject_name: tf.slope for tf in trend_forecasts
    }

    predicted_by_subject: Dict[str, float] = {
        tf.subject_name: tf.predicted_next_score for tf in trend_forecasts
    }

    avg_by_subject: Dict[str, float] = {
        cc.subject_name: cc.student_avg for cc in class_comparisons
    }

    class_avg_by_subject: Dict[str, float] = {
        cc.subject_name: cc.class_avg for cc in class_comparisons
    }

    # Collect all subject names from class_comparisons (canonical list)
    all_subjects = [cc.subject_name for cc in class_comparisons]

    priorities: List[SubjectPriority] = []
    for subject_name in all_subjects:
        weakness_score = weakness_by_subject.get(subject_name, 0.0)

        slope = slope_by_subject.get(subject_name, 0.0)
        decline_score = abs(slope) if slope < 0 else 0.0

        combined = weakness_score * WEAKNESS_WEIGHT + decline_score * DECLINE_WEIGHT

        if combined >= HIGH_THRESHOLD:
            level = "High"
        elif combined >= MEDIUM_THRESHOLD:
            level = "Medium"
        else:
            level = "Low"

        priorities.append(SubjectPriority(
            subject_name=subject_name,
            weakness_score=round(weakness_score, 1),
            decline_score=round(decline_score, 1),
            combined_priority=round(combined, 1),
            priority_level=level,
        ))

    # Sort descending by combined_priority
    priorities.sort(key=lambda p: p.combined_priority, reverse=True)
    return priorities


def compute_next_best_action(
    weak_topics: List[WeakTopic],
    trend_forecasts: List[TrendForecast],
    class_comparisons: List[ClassComparison],
) -> Optional[NextBestAction]:
    """Return the single highest-priority subject as the Next Best Action."""

    priorities = compute_subject_priorities(
        weak_topics, trend_forecasts, class_comparisons
    )

    if not priorities:
        return None

    top = priorities[0]

    # Build lookup maps for enrichment
    avg_by_subject = {cc.subject_name: cc.student_avg for cc in class_comparisons}
    class_avg_by_subject = {cc.subject_name: cc.class_avg for cc in class_comparisons}
    predicted_by_subject = {tf.subject_name: tf.predicted_next_score for tf in trend_forecasts}

    current_avg = avg_by_subject.get(top.subject_name, 0.0)
    class_avg = class_avg_by_subject.get(top.subject_name, 0.0)
    predicted = predicted_by_subject.get(top.subject_name, current_avg)

    # Build human-readable reason
    reason = _build_reason(top, current_avg, class_avg, predicted, weak_topics, trend_forecasts)

    return NextBestAction(
        subject_name=top.subject_name,
        priority_level=top.priority_level,
        reason=reason,
        current_avg=round(current_avg, 1),
        class_avg=round(class_avg, 1),
        predicted_next_score=round(predicted, 1),
    )


def _build_reason(
    top: SubjectPriority,
    current_avg: float,
    class_avg: float,
    predicted: float,
    weak_topics: List[WeakTopic],
    trend_forecasts: List[TrendForecast],
) -> str:
    """Build a plain-language reason string for the NBA."""

    is_weak = any(wt.subject_name == top.subject_name for wt in weak_topics)
    forecast = next((tf for tf in trend_forecasts if tf.subject_name == top.subject_name), None)
    is_declining = forecast and forecast.trend_label == "Declining"
    is_improving = forecast and forecast.trend_label == "Improving"

    gap = round(current_avg - class_avg, 1)

    if is_weak and is_declining:
        weak = next(wt for wt in weak_topics if wt.subject_name == top.subject_name)
        return (
            f"{top.subject_name} is {abs(weak.gap):.0f}% below your overall average "
            f"and trending downward. Focusing here can have the biggest impact."
        )
    elif is_weak:
        weak = next(wt for wt in weak_topics if wt.subject_name == top.subject_name)
        return (
            f"{top.subject_name} is {abs(weak.gap):.0f}% below your overall average. "
            f"Closing this gap would lift your overall performance."
        )
    elif is_declining:
        return (
            f"{top.subject_name} scores have been trending downward recently. "
            f"Early attention can help reverse this trajectory."
        )
    else:
        return (
            f"{top.subject_name} is your current area with the most room for growth."
        )
