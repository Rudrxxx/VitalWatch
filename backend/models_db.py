from sqlalchemy import Column, Integer, String, Float, Boolean, JSON, DateTime, ForeignKey
from database import Base
import datetime

class PredictionLog(Base):
    __tablename__ = "prediction_logs"
    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, index=True, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    map_val = Column(Float)
    hr_val = Column(Float)
    spo2_val = Column(Float)
    risk_score = Column(Float)
    alert_level = Column(String)
    was_correct = Column(Boolean, nullable=True)

class ChatSession(Base):
    __tablename__ = "chat_sessions"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("chat_sessions.session_id"))
    role = Column(String)
    content = Column(String)
    sources = Column(JSON, nullable=True)
    latency_ms = Column(Float, nullable=True)
    faithfulness_score = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class ModelRun(Base):
    __tablename__ = "model_runs"
    id = Column(Integer, primary_key=True, index=True)
    run_date = Column(DateTime, default=datetime.datetime.utcnow)
    auc_roc = Column(Float)
    f1 = Column(Float)
    precision = Column(Float)
    recall = Column(Float)
    n_patients = Column(Integer)
    notes = Column(String, nullable=True)
