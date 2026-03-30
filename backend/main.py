import os
import uuid
import uvicorn
import logging
from datetime import datetime
from contextlib import asynccontextmanager
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from predict import PredictionEngine
from rag import RAGPipeline

from schemas import (
    VitalSigns, PredictionResponse, ExplainRequest, ExplainResponse,
    RAGRequest, RAGResponse, HealthResponse
)
from database import engine, Base, get_db
from models_db import PredictionLog, ChatSession, ChatMessage, ModelRun

logging.basicConfig(level=logging.INFO)
load_dotenv()

prediction_engine = None
rag_pipeline = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global prediction_engine, rag_pipeline
    logging.info("Starting up VitalWatch2 Backend...")
    
    # Auto-create tables
    Base.metadata.create_all(bind=engine)
    logging.info("Database tables initialized.")
    
    try:
        prediction_engine = PredictionEngine()
    except Exception as e:
        logging.error(f"Failed to load PredictionEngine: {e}")
        
    openai_key = os.environ.get("OPENAI_API_KEY")
    if openai_key and openai_key != "your_key_here":
        try:
            rag_pipeline = RAGPipeline(openai_api_key=openai_key)
        except Exception as e:
            logging.error(f"Failed to load RAGPipeline: {e}")
    
    yield
    logging.info("Shutting down...")

app = FastAPI(title="VitalWatch2 API", lifespan=lifespan)

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
        case_col = 'case_id' if 'case_id' in prediction_engine.df.columns else prediction_engine.df.columns[0]
        total_cases = prediction_engine.df[case_col].nunique()
    return HealthResponse(status="healthy" if model_loaded or rag_ready else "degraded", model_loaded=model_loaded, rag_ready=rag_ready, total_cases=int(total_cases))

@app.post("/predict", response_model=PredictionResponse)
def predict(vital_signs: VitalSigns, db: Session = Depends(get_db)):
    if not prediction_engine or prediction_engine.model is None:
        raise HTTPException(status_code=500, detail="Models missing")
    
    vs_dict = vital_signs.model_dump()
    risk_score, alert_level, alert_message = prediction_engine.predict(vs_dict)
    
    new_log = PredictionLog(
        map_val=vs_dict.get('MAP_current'),
        hr_val=vs_dict.get('HR_current'),
        spo2_val=vs_dict.get('SpO2_current'),
        risk_score=risk_score,
        alert_level=alert_level
    )
    db.add(new_log)
    db.commit()
    
    return PredictionResponse(risk_score=risk_score, risk_percent=risk_score * 100, alert_level=alert_level, alert_message=alert_message, timestamp=datetime.utcnow().isoformat() + "Z")

@app.post("/explain", response_model=ExplainResponse)
def explain(explain_req: ExplainRequest):
    if not prediction_engine or prediction_engine.model is None:
        raise HTTPException(status_code=500, detail="Models missing")
    vs_dict = explain_req.model_dump(exclude={'case_id'})
    features_impact = prediction_engine.explain(vs_dict)
    return ExplainResponse(shap_values={f["name"]: f["impact"] for f in features_impact}, top_features=features_impact)

@app.get("/patient/{case_id}")
def get_patient(case_id: int):
    data = prediction_engine.get_patient_data(case_id)
    if not data: raise HTTPException(status_code=404, detail="Not found")
    return data

@app.get("/analytics")
def get_analytics():
    return prediction_engine.get_analytics()

@app.post("/rag/query")
def rag_query(req: RAGRequest, db: Session = Depends(get_db)):
    if not rag_pipeline: raise HTTPException(status_code=500, detail="RAG Pipeline offline.")
    
    answer, sources, latency_ms = rag_pipeline.query(req.question, req.patient_context)
    retrieved_docs = rag_pipeline.vectorstore.similarity_search(req.question, k=3)
    eval_scores = rag_pipeline.evaluate_response(req.question, answer, retrieved_docs)
    
    sess_id = "default-session"
    if not db.query(ChatSession).filter(ChatSession.session_id == sess_id).first():
        db.add(ChatSession(session_id=sess_id))
        db.commit()
        
    user_msg = ChatMessage(session_id=sess_id, role="user", content=req.question)
    bot_msg = ChatMessage(
        session_id=sess_id, role="assistant", content=answer, 
        sources=sources, latency_ms=latency_ms, 
        faithfulness_score=eval_scores.get("faithfulness_score")
    )
    db.add(user_msg)
    db.add(bot_msg)
    db.commit()
    
    return {"answer": answer, "sources": sources, "latency_ms": latency_ms, "evaluation": eval_scores}

@app.get("/rag/suggestions")
def get_rag_suggestions():
    return [
        "What are the defining clinical thresholds for intraoperative hypotension?",
        "How is IOH treated when general anesthesia is the primary cause?",
        "What are the severe post-operative consequences of prolonged MAP drops?",
        "Is an elderly patient with hypertension at higher risk for hypotension?",
        "What is the difference between ephedrine and phenylephrine?",
        "How does spinal anesthesia induce vascular dilation?",
        "What is goal-directed fluid therapy?",
        "How does the model predict these events in advance?"
    ]

@app.get("/history/{session_id}")
def get_chat_history(session_id: str, db: Session = Depends(get_db)):
    messages = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at).all()
    return [{"role": m.role, "content": m.content, "sources": m.sources} for m in messages]
