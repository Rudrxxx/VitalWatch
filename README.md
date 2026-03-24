# VitalWatch2 📉
**Clinical AI Intelligence & Predictive Hemodynamic System**

VitalWatch2 is a high-performance clinical dashboard and surgical warning platform. It uses machine learning models securely integrated with an underlying RAG pipeline via LLMs to synthesize incoming telemetry (Mean Arterial Pressure, Heart Rate, and SpO2) and preemptively predict intraoperative hypotension (IOH).

## Production Architecture
- **Frontend Engine**: React, Vite, Tailwind CSS v4, Three.js (@react-three/fiber), Framer Motion, Recharts.
- **Backend Analytics**: FastAPI, Scikit-Learn, SHAP, Pandas.
- **RAG Subsystem**: FAISS, OpenAI GPT-4o-mini, Langchain.
- **Persistent Storage**: PostgreSQL (via SQLAlchemy API hooks).

## Quick Start
Assuming you have Docker and NodeJS/Python environments active:

1. `docker-compose up -d db` *(Boots postgres isolated container)*
2. `pip3 install -r requirements.txt` *(Sets up ML bindings)*
3. `cd frontend && npm install` *(Binds UI)*
4. Ensure `.env` is securely loaded with valid keys (`OPENAI_API_KEY`).
5. Run the backend orchestrator instance:
   ```bash
   cd backend && python3 main.py
   ```
6. Run the Vite interface layer (in an alternate terminal):
   ```bash
   cd frontend && npm run dev
   ```
7. Open **http://localhost:5173** to actively monitor the cockpit framework!
