import axios from 'axios';

const api = axios.create({
  baseURL: '/api' // Directs gracefully through Vite server proxy locally or production reverse-proxy in deployment
});

export const getHealth = async () => {
    const res = await api.get('/health');
    return res.data;
};

export const getAnalytics = async () => {
    const res = await api.get('/analytics');
    return res.data;
};

export const getPatient = async (caseId) => {
    const res = await api.get(`/patient/${caseId}`);
    return res.data;
};

export const predict = async (vitalSigns) => {
    const res = await api.post('/predict', vitalSigns);
    return res.data;
};

export const explain = async (vitalSigns) => {
    const res = await api.post('/explain', vitalSigns);
    return res.data;
};

export const ragQuery = async (question, patientContext = null) => {
    const res = await api.post('/rag/query', { 
        question, 
        patient_context: patientContext 
    });
    return res.data;
};

export const getRagSuggestions = async () => {
    const res = await api.get('/rag/suggestions');
    return res.data;
};
