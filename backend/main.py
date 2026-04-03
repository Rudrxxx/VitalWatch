import os
import uvicorn
import logging
from datetime import datetime
from contextlib import asynccontextmanager
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from predict import PredictionEngine
from rag import RAGPipeline
from schemas import (
    VitalSigns, PredictionResponse, ExplainRequest, ExplainResponse,
    RAGRequest, HealthResponse
)
from database import engine, Base, get_db, test_connection
from models_db import PredictionLog, ChatSession, ChatMessage

logging.basicConfig(level=logging.INFO)
load_dotenv()

prediction_engine = None
rag_pipeline = None
db_available = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    global prediction_engine, rag_pipeline, db_available
    logging.info("🚀 Starting VitalWatch 2.0...")

    db_available = test_connection()
    if db_available:
        try:
            Base.metadata.create_all(bind=engine)
            logging.info("✅ Database tables ready")
        except Exception as e:
            logging.warning(f"Table creation failed: {e}")
            db_available = False

    try:
        prediction_engine = PredictionEngine()
        logging.info("✅ Prediction engine loaded")
    except Exception as e:
        logging.error(f"❌ PredictionEngine failed: {e}")

    openai_key = os.environ.get("OPENAI_API_KEY", "")
    if openai_key and openai_key not in ("your_key_here", ""):
        try:
            rag_pipeline = RAGPipeline(openai_api_key=openai_key)
            logging.info("✅ RAG pipeline ready")
        except Exception as e:
            logging.error(f"❌ RAGPipeline failed: {e}")
    else:
        logging.warning("⚠️  No OPENAI_API_KEY — RAG chatbot disabled")

    logging.info("✅ API docs: http://localhost:8000/docs")
    yield
    logging.info("Shutting down...")


app = FastAPI(title="VitalWatch 2.0 API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health_check():
    model_loaded = prediction_engine is not None and prediction_engine.model is not None
    rag_ready = rag_pipeline is not None
    total_cases = 0
    if prediction_engine and not prediction_engine.df.empty:
        total_cases = int(prediction_engine.df["case_id"].nunique())
    return HealthResponse(
        status="healthy" if model_loaded else "degraded",
        model_loaded=model_loaded,
        rag_ready=rag_ready,
        total_cases=total_cases,
    )


@app.post("/predict", response_model=PredictionResponse)
def predict(vital_signs: VitalSigns, db: Session = Depends(get_db)):
    if not prediction_engine or prediction_engine.model is None:
        raise HTTPException(status_code=500, detail="Model not loaded")

    vs_dict = vital_signs.model_dump()
    risk_score, alert_level, alert_message = prediction_engine.predict(vs_dict)

    if db_available:
        try:
            db.add(PredictionLog(
                map_val=vs_dict.get("MAP_current"),
                hr_val=vs_dict.get("HR_current"),
                spo2_val=vs_dict.get("SpO2_current"),
                risk_score=risk_score,
                alert_level=alert_level,
            ))
            db.commit()
        except Exception as e:
            logging.warning(f"DB log failed: {e}")
            db.rollback()

    return PredictionResponse(
        risk_score=risk_score,
        risk_percent=risk_score * 100,
        alert_level=alert_level,
        alert_message=alert_message,
        timestamp=datetime.utcnow().isoformat() + "Z",
    )


@app.post("/explain")
def explain(explain_req: ExplainRequest):
    if not prediction_engine or prediction_engine.model is None:
        raise HTTPException(status_code=500, detail="Model not loaded")
    vs_dict = explain_req.model_dump(exclude={"case_id"})
    features_impact = prediction_engine.explain(vs_dict)
    return {"shap_values": {f["name"]: f["impact"] for f in features_impact}, "top_features": features_impact}


@app.get("/patient/{case_id}")
def get_patient(case_id: int):
    if not prediction_engine:
        raise HTTPException(status_code=500, detail="Engine not ready")
    data = prediction_engine.get_patient_data(case_id)
    if not data:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")
    return data


@app.get("/analytics")
def get_analytics():
    if not prediction_engine:
        raise HTTPException(status_code=500, detail="Engine not ready")
    return prediction_engine.get_analytics()


@app.post("/rag/query")
def rag_query(req: RAGRequest, db: Session = Depends(get_db)):
    if not rag_pipeline:
        raise HTTPException(
            status_code=503,
            detail="RAG pipeline offline. Add OPENAI_API_KEY to .env and restart.",
        )

    answer, sources, latency_ms = rag_pipeline.query(req.question, req.patient_context)
    retrieved_docs = rag_pipeline.vectorstore.similarity_search(req.question, k=3)
    eval_scores = rag_pipeline.evaluate_response(req.question, answer, retrieved_docs)

    if db_available:
        try:
            sess_id = "default-session"
            if not db.query(ChatSession).filter(ChatSession.session_id == sess_id).first():
                db.add(ChatSession(session_id=sess_id))
                db.commit()
            db.add(ChatMessage(session_id=sess_id, role="user", content=req.question))
            db.add(ChatMessage(
                session_id=sess_id, role="assistant", content=answer,
                sources=sources, latency_ms=latency_ms,
                faithfulness_score=eval_scores.get("faithfulness_score"),
            ))
            db.commit()
        except Exception as e:
            logging.warning(f"DB chat log failed: {e}")
            db.rollback()

    return {"answer": answer, "sources": sources, "latency_ms": latency_ms, "evaluation": eval_scores}


@app.get("/rag/suggestions")
def get_rag_suggestions():
    return [
        "What are the clinical thresholds for intraoperative hypotension?",
        "How is IOH treated when general anesthesia is the cause?",
        "What are consequences of prolonged MAP drops below 65 mmHg?",
        "Is an elderly patient with hypertension at higher risk for IOH?",
        "What is the difference between ephedrine and phenylephrine?",
        "How does spinal anesthesia cause vasodilation and hypotension?",
        "What is goal-directed fluid therapy in surgery?",
        "How does the VitalWatch model predict IOH events in advance?",
    ]


@app.get("/history/{session_id}")
def get_chat_history(session_id: str, db: Session = Depends(get_db)):
    if not db_available:
        return []
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at)
        .all()
    )
    return [{"role": m.role, "content": m.content, "sources": m.sources} for m in messages]


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
