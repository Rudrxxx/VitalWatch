# VitalWatch 2.0

> **AI-powered intraoperative hypotension prediction platform**  
> Early warning system for surgeons and anesthesiologists · AUC-ROC 0.91 · 6,388 real patients

---

## What It Does

VitalWatch 2.0 monitors real-time surgical vital signs and **predicts dangerous drops in blood pressure (MAP < 65 mmHg) up to 1 minute before they happen** — giving anesthesiologists time to intervene before a crisis occurs.

It is a full-stack AI/ML platform combining:
- **Logistic Regression** trained on 397,000 seconds of real surgery data
- **SHAP explainability** — every alert is explained, not just flagged
- **RAG chatbot** grounded in 16 anesthesia clinical guidelines
- **FastAPI backend** with PostgreSQL/SQLite logging
- **React + Vite frontend** with live surgical replay

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   React + Vite Frontend                  │
│  Landing │ Monitor │ Analytics │ Performance │ Chatbot   │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP (Vite proxy → /api)
┌────────────────────▼────────────────────────────────────┐
│                  FastAPI Backend (:8000)                 │
│                                                         │
│  /predict   /explain   /analytics   /patient/{id}       │
│  /rag/query   /rag/suggestions   /history/{session}     │
└──────┬──────────────┬──────────────────┬───────────────┘
       │              │                  │
┌──────▼──────┐ ┌─────▼──────┐  ┌───────▼──────────┐
│  ML Model   │ │ RAG Pipeline│  │  PostgreSQL /    │
│  (sklearn)  │ │  LangChain  │  │  SQLite (logs)   │
│  SHAP       │ │  FAISS      │  └──────────────────┘
│  ioh_model  │ │  GPT-4o-mini│
└─────────────┘ └─────────────┘
       ↑
┌──────┴──────┐
│  VitalDB    │
│  6,388 cases│
│  test_sample│
└─────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4, Framer Motion |
| 3D / Charts | Three.js (@react-three/fiber), Recharts |
| Backend | FastAPI, Uvicorn, Python 3.10+ |
| ML | scikit-learn (Logistic Regression), SHAP, NumPy, pandas |
| RAG | LangChain, FAISS, OpenAI (GPT-4o-mini + text-embedding-3-small) |
| Database | PostgreSQL (Supabase) or SQLite (local fallback) |
| ORM | SQLAlchemy |
| Data Source | VitalDB (PhysioNet) — 6,388 surgical patients |

---

## Model Performance

| Metric | Score |
|---|---|
| AUC-ROC | **0.91** |
| Recall (IOH) | 0.89 |
| Precision (IOH) | 0.37 |
| F1 Score | 0.52 |
| Training data | 316,025 rows (57 patients) |
| Test data | 81,134 rows (12 patients) |
| Prediction horizon | 1 minute ahead |
| IOH definition | MAP < 65 mmHg |

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Server status, model loaded, RAG ready |
| POST | `/predict` | Predict IOH risk from 29 vital sign features |
| POST | `/explain` | SHAP explanation for a prediction |
| GET | `/patient/{case_id}` | All rows for a surgical case |
| GET | `/analytics` | Aggregated stats across all test patients |
| POST | `/rag/query` | Ask a clinical question (RAG) |
| GET | `/rag/suggestions` | 8 suggested clinical questions |
| GET | `/history/{session_id}` | Chat history from database |

Interactive docs: `http://localhost:8000/docs`

---

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- OpenAI API key (for RAG chatbot — app works without it)
- Supabase account OR nothing (SQLite used automatically)

### 1 — Clone and set up environment

```bash
git clone <your-repo-url>
cd VitalWatch2

# Copy env file and fill in your keys
cp .env.example .env
```

Edit `.env`:
```env
OPENAI_API_KEY=sk-...your-key-here...

# Supabase (optional — app works without this):
# DATABASE_URL=postgresql://postgres:[password]@db.xxxx.supabase.co:5432/postgres
```

### 2 — Start the backend

```bash
cd backend
pip install -r ../requirements.txt
python main.py
```

You should see:
```
✅ Database tables ready
✅ Prediction engine loaded
✅ RAG pipeline ready
✅ API docs: http://localhost:8000/docs
```

### 3 — Start the frontend

```bash
# In a new terminal
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## App Pages

### 🏠 Landing Page (`/`)
- Three.js 3D rotating wireframe with particle system
- Animated ECG line
- Count-up stats on scroll

### 🖥 Live Monitor (`/monitor`)
- Select any surgical case from the dataset
- Hit **Play** to replay the surgery second-by-second
- Watch MAP, HR, SpO2 update live in the chart
- Risk score updates each step via the ML model
- Red alert banner fires when risk > 60%
- SHAP panel shows which features are driving the risk

### 📊 Analytics (`/analytics`)
- Population-level stats across all test patients
- MAP distribution histogram
- IOH rate per patient (color-coded)
- Risk score distribution
- Full case summary table

### 🧪 Performance (`/performance`)
- ROC curve (AUC = 0.91)
- Confusion matrix
- Feature importance with staggered animation
- Interactive threshold slider — watch precision/recall/F1 update live

### 🤖 Clinical AI Chatbot (`/chatbot`)
- Ask any anesthesiology question in plain English
- Answers grounded in 16 clinical guidelines via FAISS vector search
- Source citations on every answer
- Patient mode: inject a patient's vitals into the query context
- Typewriter effect on AI responses
- Faithfulness score shown for each answer

---

## Project Structure

```
VitalWatch2/
├── backend/
│   ├── main.py          # FastAPI app, all endpoints
│   ├── predict.py       # PredictionEngine (model + SHAP)
│   ├── rag.py           # RAGPipeline (LangChain + FAISS)
│   ├── database.py      # SQLAlchemy setup (Postgres/SQLite)
│   ├── models_db.py     # DB table definitions
│   ├── schemas.py       # Pydantic request/response models
│   └── analytics.py     # (reserved for future analytics)
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── LandingPage.jsx
│       │   ├── MonitorPage.jsx
│       │   ├── AnalyticsPage.jsx
│       │   ├── PerformancePage.jsx
│       │   └── ChatbotPage.jsx
│       ├── components/
│       │   ├── Navbar.jsx
│       │   ├── AlertBanner.jsx
│       │   └── StatCard.jsx
│       └── lib/
│           └── api.js   # All axios API calls
├── models/
│   ├── ioh_model.pkl    # Trained LogisticRegression
│   ├── ioh_scaler.pkl   # StandardScaler
│   └── feature_cols.pkl # 29 feature names
├── data/
│   └── test_sample.csv  # 81,854 rows, 12 patients
├── .env.example
├── requirements.txt
└── README.md
```

---

## What to Say in Interviews

> *"I built an end-to-end clinical AI platform on 6,388 real surgical patients from the VitalDB dataset. The core is a logistic regression model that predicts intraoperative hypotension — dangerous blood pressure drops — up to 1 minute before they occur, achieving AUC-ROC 0.91. I used SHAP explainability so every alert shows the exact features driving the risk. On top of the ML pipeline I built a FastAPI backend, a React frontend with live surgery replay, and a RAG chatbot grounded in 16 anesthesia guidelines using LangChain and FAISS vector search."*

**Key things to highlight:**
- Real clinical dataset (not Kaggle toy data)
- Patient-level train/test split to prevent data leakage
- SHAP explainability — critical for healthcare AI
- AUC-ROC 0.91 with 89% recall on IOH events
- Full stack: React + FastAPI + PostgreSQL + RAG
- The live surgery replay demo — interviewers remember it

---

## Database Notes

The app works in 3 database modes — zero config needed:

| Mode | Setup | What gets logged |
|---|---|---|
| No DB (default) | Nothing | Nothing — app fully functional |
| SQLite | Set `DATABASE_URL=sqlite:///./vitalwatch.db` | All predictions + chat history |
| Supabase/Postgres | Set full `DATABASE_URL` in `.env` | Same, visible in Supabase dashboard |

---

## Dataset Credit

Data from **VitalDB** — a high-fidelity intraoperative vital signs database:  
> Lee HC et al. *VitalDB, a high-fidelity multi-parameter vital signs database in surgical patients.* Scientific Data, 2022.  
> https://vitaldb.net · https://physionet.org/content/vitaldb/1.0.0/

---

## License

MIT License — free to use, modify and showcase in your portfolio.

---

<div align="center">
Built with real surgical data · Powered by VitalDB · AUC-ROC 0.91
</div>
