import os
import time
import logging
import re
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document

class RAGPipeline:
    def __init__(self, openai_api_key=None):
        if not openai_api_key:
            raise ValueError("OpenAI API key is required to initialize RAGPipeline.")
            
        self.api_key = openai_api_key
        self.base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.index_path = os.path.join(self.base_dir, 'data', 'faiss_index')
        
        # Setup embeddings
        self.embeddings = OpenAIEmbeddings(
            model="text-embedding-3-small", 
            openai_api_key=self.api_key
        )
        
        # Setup LLM
        self.llm = ChatOpenAI(
            model="gpt-4o-mini",
            temperature=0,
            openai_api_key=self.api_key
        )
        
        # Build Knowledge base
        self.documents = self._build_knowledge_base()
        
        # Load or Build Index
        if os.path.exists(os.path.join(self.index_path, "index.faiss")) or os.path.exists(os.path.join(self.index_path, "index.pkl")):
            try:
                # `allow_dangerous_deserialization=True` is needed for loading FAISS index with pickle in newer langchain versions
                self.vectorstore = FAISS.load_local(self.index_path, self.embeddings, allow_dangerous_deserialization=True)
                logging.info("Successfully loaded FAISS index.")
            except Exception as e:
                logging.warning(f"Failed to load FAISS index ({e}). Rebuilding...")
                self.build_index()
        else:
            self.build_index()

    def _build_knowledge_base(self):
        docs = [
            Document(page_content="Intraoperative hypotension (IOH) is generally defined as a mean arterial pressure (MAP) falling below 65 mmHg during surgery. It is a critical event requiring rapid intervention to ensure organ perfusion.", metadata={"source": "Definition of IOH"}),
            Document(page_content="One of the primary clinical causes of intraoperative hypotension is spinal anesthesia. The resultant sympathetic blockade causes vasodilation and subsequent drops in blood pressure.", metadata={"source": "Causes: Spinal Anesthesia"}),
            Document(page_content="General anesthesia agents commonly cause vasodilation and myocardial depression, which can result in reduced systemic vascular resistance and intraoperative hypotension.", metadata={"source": "Causes: General Anesthesia"}),
            Document(page_content="Significant blood loss or hemorrhage during surgical procedures reduces circulating blood volume, directly lowering the mean arterial pressure and causing IOH.", metadata={"source": "Causes: Blood Loss"}),
            Document(page_content="Vasodilation induced by anesthetic drugs, patient positioning, or anaphylaxis can cause profound hypotension by dropping systemic vascular resistance rather than volume depletion.", metadata={"source": "Causes: Vasodilation"}),
            Document(page_content="Elderly patients have stiffer vasculature and impaired autonomic reflexes, heavily increasing their risk of developing severe intraoperative hypotension under anesthesia.", metadata={"source": "Risk Factors: Elderly Patients"}),
            Document(page_content="A high American Society of Anesthesiologists (ASA) physical status score indicates higher baseline morbidity, serving as a primary risk factor for adverse intraoperative hemodynamic events including IOH.", metadata={"source": "Risk Factors: High ASA"}),
            Document(page_content="Pre-existing hypertension can ironically predispose to intraoperative hypotension because these patients require higher baseline pressures and are highly sensitive to the vasodilatory effects of anesthetic drugs.", metadata={"source": "Risk Factors: Pre-existing Hypertension"}),
            Document(page_content="Patients with diabetes often suffer from autonomic neuropathy, impairing their physiological ability to compensate for sudden hemodynamic shifts and increasing risk of IOH.", metadata={"source": "Risk Factors: Diabetes"}),
            Document(page_content="The primary and most rapid treatment for profound IOH involves vasopressors. Common agents include phenylephrine for pure alpha-agonism, ephedrine for mixed alpha/beta, and norepinephrine for severe refractory cases.", metadata={"source": "Treatment: Vasopressors"}),
            Document(page_content="Intravenous (IV) fluids remain a critical treatment modality for IOH, especially when the hypotension is volume-driven due to fasting, blood loss, or insensible fluid losses during surgery.", metadata={"source": "Treatment: IV Fluids"}),
            Document(page_content="If a patient experiences IOH without volume depletion or surgical bleeding, the anesthesiologist may need to reduce the depth of anesthesia to reverse the drug-induced vasodilation and cardiac depression.", metadata={"source": "Treatment: Reduce Anesthetic Depth"}),
            Document(page_content="Prevention strategies for IOH include pre-loading intravenous fluids prior to inducing anesthesia, particularly before spinal blocks, to maintain adequate preload.", metadata={"source": "Prevention: Fluid Pre-loading"}),
            Document(page_content="Goal-directed fluid therapy uses dynamic variables like pulse pressure variation or stroke volume variation to optimize fluid management and actively prevent IOH.", metadata={"source": "Prevention: Goal-Directed Therapy"}),
            Document(page_content="Prolonged intraoperative hypotension leads to severe post-operative consequences. The most notable outcomes include acute kidney injury (AKI), myocardial injury, stroke, and an overall increased 30-day mortality risk.", metadata={"source": "Consequences of IOH"}),
            Document(page_content="The VitalDB dataset provides high-resolution intraoperative vital signs, including MAP and HR. The ML model utilizes derived features, trends, and variances from this dataset to predict IOH events before they manifest.", metadata={"source": "VitalDB Dataset & ML Model"}),
        ]
        return docs

    def build_index(self):
        logging.info("Building FAISS vector index from knowledge base...")
        os.makedirs(self.index_path, exist_ok=True)
        self.vectorstore = FAISS.from_documents(self.documents, self.embeddings)
        self.vectorstore.save_local(self.index_path)
        logging.info(f"FAISS index successfully saved to {self.index_path}")

    def query(self, question, patient_context=None):
        start_time = time.time()
        
        # Retrieve context
        retrieved_docs = self.vectorstore.similarity_search(question, k=3)
        context_text = "\n\n".join([f"Source: {doc.metadata.get('source', 'Unknown')}\n{doc.page_content}" for doc in retrieved_docs])
        sources = [doc.metadata.get('source', 'Unknown') for doc in retrieved_docs]
        
        # Build prompt
        system_message = "You are a clinical anesthesiology assistant. Answer based only on the provided context. Be precise and cite sources."
        
        full_query = question
        if patient_context:
            full_query = f"Patient Context: {patient_context}\n\nQuestion: {question}"
            
        prompt = f"{system_message}\n\nContext:\n{context_text}\n\n{full_query}"
        
        # Invoke LLM
        from langchain_core.messages import HumanMessage
        response = self.llm.invoke([HumanMessage(content=prompt)])
        answer = response.content
        
        latency_ms = (time.time() - start_time) * 1000
        
        return answer, sources, latency_ms

    def evaluate_response(self, question, answer, retrieved_docs):
        if not retrieved_docs or not answer:
            return {
                "faithfulness_score": 0.0,
                "retrieval_count": len(retrieved_docs),
                "estimated_hallucination_risk": "high"
            }
            
        combined_context = " ".join([d.page_content.lower() for d in retrieved_docs])
        
        # Tokenize answer by words
        words_in_answer = set(re.findall(r'\b[a-z]{2,}\b', answer.lower()))
        
        # Standard filter to remove simple prepositions and conjunctions without needing NLTK stop words list
        stop_words = {"the", "and", "for", "with", "are", "but", "not", "you", "all", "any", "can", "has", "was",
                      "that", "from", "this", "they", "have", "been", "one", "were"}
        relevant_words = words_in_answer - stop_words
        
        match_count = sum(1 for w in relevant_words if w in combined_context)
        
        if len(relevant_words) == 0:
            faithfulness_score = 1.0 # Fallback 
        else:
            faithfulness_score = match_count / len(relevant_words)
            
        # Classify risk
        if faithfulness_score > 0.6:
            risk = "low"
        elif faithfulness_score > 0.3:
            risk = "medium"
        else:
            risk = "high"
            
        return {
            "faithfulness_score": float(faithfulness_score),
            "retrieval_count": len(retrieved_docs),
            "estimated_hallucination_risk": risk
        }
