import sys
import os
import random
from datetime import date, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from app.database import engine, SessionLocal, Base
from app.models import Student, Subject, ScoreRecord

def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    db.query(ScoreRecord).delete()
    db.query(Student).delete()
    db.query(Subject).delete()
    db.commit()

    subject_names = [
        "Mathematics", "Science", "English",
        "History", "Geography", "Computer Science",
    ]
    subjects = {}
    for name in subject_names:
        s = Subject(name=name)
        db.add(s)
        db.flush()
        subjects[name] = s

    student_profiles = [
        ("Aarav Sharma",   "10A", 78, {"Mathematics": 10, "Science": 5, "English": -15, "History": -5, "Geography": 0, "Computer Science": 8}, "stable"),
        ("Priya Patel",    "10A", 85, {"Mathematics": -20, "Science": 0, "English": 5, "History": 5, "Geography": 0, "Computer Science": -5}, "declining"),
        ("Rohan Singh",    "10A", 55, {"Mathematics": -5, "Science": -10, "English": 5, "History": 0, "Geography": 0, "Computer Science": -5}, "improving"),
        ("Ananya Reddy",   "10A", 72, {"Mathematics": 5, "Science": 5, "English": 5, "History": -15, "Geography": -10, "Computer Science": 10}, "volatile"),
        ("Vikram Joshi",   "10A", 90, {"Mathematics": 5, "Science": 5, "English": 0, "History": 0, "Geography": 0, "Computer Science": 5}, "stable"),
        ("Meera Iyer",     "10A", 68, {"Mathematics": -10, "Science": -5, "English": 10, "History": 5, "Geography": 5, "Computer Science": -15}, "improving"),

        ("Arjun Nair",     "10B", 82, {"Mathematics": 8, "Science": 5, "English": -5, "History": -10, "Geography": 0, "Computer Science": 10}, "stable"),
        ("Kavya Menon",    "10B", 60, {"Mathematics": -15, "Science": -10, "English": 5, "History": 0, "Geography": 5, "Computer Science": -10}, "declining"),
        ("Siddharth Das",  "10B", 75, {"Mathematics": 0, "Science": 10, "English": -5, "History": 5, "Geography": -5, "Computer Science": 0}, "volatile"),
        ("Diya Gupta",     "10B", 88, {"Mathematics": 5, "Science": 0, "English": 5, "History": -5, "Geography": 0, "Computer Science": 5}, "improving"),
        ("Aditya Kumar",   "10B", 50, {"Mathematics": -5, "Science": -8, "English": 0, "History": -5, "Geography": 0, "Computer Science": -10}, "declining"),
        ("Ishita Bose",    "10B", 70, {"Mathematics": 10, "Science": -5, "English": -10, "History": 5, "Geography": 5, "Computer Science": 0}, "stable"),

        ("Rahul Verma",    "11A", 80, {"Mathematics": 5, "Science": 10, "English": -10, "History": -5, "Geography": 0, "Computer Science": 5}, "improving"),
        ("Sneha Kapoor",   "11A", 65, {"Mathematics": -20, "Science": 0, "English": 10, "History": 5, "Geography": 5, "Computer Science": -15}, "volatile"),
        ("Karthik Rao",    "11A", 92, {"Mathematics": 3, "Science": 3, "English": 0, "History": 0, "Geography": -3, "Computer Science": 5}, "stable"),
        ("Neha Saxena",    "11A", 58, {"Mathematics": -5, "Science": -10, "English": 0, "History": -5, "Geography": 5, "Computer Science": -5}, "improving"),
        ("Amit Tiwari",    "11A", 73, {"Mathematics": 5, "Science": 0, "English": -15, "History": -10, "Geography": 5, "Computer Science": 10}, "declining"),
        ("Pooja Mishra",   "11A", 77, {"Mathematics": 0, "Science": 5, "English": 5, "History": -5, "Geography": -5, "Computer Science": 0}, "volatile"),
    ]

    test_dates = [
        date(2024, 7, 15),
        date(2024, 9, 10),
        date(2024, 11, 5),
        date(2025, 1, 20),
        date(2025, 3, 15),
    ]
    test_names = [
        "Unit Test 1", "Mid-Term Exam", "Unit Test 2",
        "Pre-Final Exam", "Final Exam",
    ]

    random.seed(42)

    for name, grade, base, adjustments, trend in student_profiles:
        student = Student(name=name, grade=grade, is_mock=True)
        db.add(student)
        db.flush()

        for subject_name, adjustment in adjustments.items():
            subject = subjects[subject_name]

            for i, (test_date, test_name) in enumerate(zip(test_dates, test_names)):
                score = base + adjustment

                if trend == "improving":
                    score += i * 3
                elif trend == "declining":
                    score -= i * 3
                elif trend == "volatile":
                    score += (15 if i % 2 == 0 else -15)

                noise = random.randint(-5, 5)
                score += noise
                score = max(5, min(100, score))

                record = ScoreRecord(
                    student_id=student.id,
                    subject_id=subject.id,
                    score=score,
                    max_score=100,
                    test_name=test_name,
                    date=test_date,
                )
                db.add(record)

    db.commit()

    n_students = db.query(Student).count()
    n_subjects = db.query(Subject).count()
    n_scores = db.query(ScoreRecord).count()
    print(f"[OK] Seeded {n_students} mock students, {n_subjects} subjects, {n_scores} score records.")
    print(f"  Database: edupulse.db")

    db.close()

if __name__ == "__main__":
    seed()
