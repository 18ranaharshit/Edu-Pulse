# ==============================================================================
# DEMO / HACKATHON AUTHENTICATION NOTICE
# ==============================================================================
# All API endpoints in this application are currently unauthenticated by design
# for hackathon demo purposes to enable quick evaluation and testing.
#
# In a production deployment, all routes (students, scores, insights) MUST be
# secured using authentication & authorization mechanisms (e.g., OAuth2 with JWT)
# along with Role-Based Access Control (RBAC):
#   - Students: Authorized to access only their individual scores and insights.
#   - Teachers / Administrators: Authorized to access class rosters and upload scores.
# ==============================================================================

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine, Base, SessionLocal
from .models import Student
from .routers import students, scores, insights

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="EduPulse API",
    description=(
        "Turn raw academic scores into personalized, explainable "
        "learning recommendations. No LLMs - just rules + real ML."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_seed():
    db = SessionLocal()
    try:
        if db.query(Student).count() == 0:
            from .seed.mock_data import seed
            seed()
    except Exception as e:
        print(f"Startup seeding notice: {e}")
    finally:
        db.close()

app.include_router(students.router)
app.include_router(scores.router)
app.include_router(insights.router)

@app.get("/", tags=["health"])
def health_check():
    return {"status": "healthy", "app": "EduPulse", "version": "1.0.0"}

