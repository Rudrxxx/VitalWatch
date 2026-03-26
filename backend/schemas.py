from pydantic import BaseModel
from typing import Dict, List, Any, Optional

class VitalSigns(BaseModel):
    MAP_current: float
    HR_current: float
    SpO2_current: float
    
    MAP_mean_1m: float
    MAP_mean_3m: float
    MAP_std_1m: float
    MAP_min_1m: float
    MAP_min_3m: float
    MAP_trend_30s: float
    MAP_trend_60s: float
    
    HR_mean_1m: float
    HR_mean_3m: float
    HR_std_1m: float
    HR_min_1m: float
    HR_min_3m: float
    HR_trend_30s: float
    HR_trend_60s: float
    
    SpO2_mean_1m: float
    SpO2_mean_3m: float
    SpO2_std_1m: float
    SpO2_min_1m: float
    SpO2_min_3m: float
    SpO2_trend_30s: float
    SpO2_trend_60s: float
    
    map_distance_to_65: float
    map_below_75: float
    map_below_70: float
    map_dropping_fast: float
    hr_map_ratio: float

class PredictionResponse(BaseModel):
    risk_score: float
    risk_percent: float
    alert_level: str
    alert_message: str
    timestamp: str

class ExplainRequest(VitalSigns):
    case_id: int

class ExplainResponse(BaseModel):
    shap_values: Dict[str, Any]
    top_features: List[Dict[str, Any]]

class RAGRequest(BaseModel):
    question: str
    patient_context: Optional[str] = None

class RAGResponse(BaseModel):
    answer: str
    sources: List[str]
    latency_ms: float

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    rag_ready: bool
    total_cases: int
