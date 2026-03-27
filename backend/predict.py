import os
import pickle
import numpy as np
import pandas as pd
import shap
import logging

class PredictionEngine:
    def __init__(self):
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        
        self.model_path = os.path.join(base_dir, 'models', 'ioh_model.pkl')
        self.scaler_path = os.path.join(base_dir, 'models', 'ioh_scaler.pkl')
        self.features_path = os.path.join(base_dir, 'models', 'feature_cols.pkl')
        self.data_path = os.path.join(base_dir, 'data', 'test_sample.csv')
        
        self.model = None
        self.scaler = None
        self.feature_cols = None
        self.df = pd.DataFrame()
        
        try:
            if os.path.exists(self.model_path):
                with open(self.model_path, 'rb') as f:
                    self.model = pickle.load(f)
            else:
                logging.warning(f"Model file not found at {self.model_path}")
                
            if os.path.exists(self.scaler_path):
                with open(self.scaler_path, 'rb') as f:
                    self.scaler = pickle.load(f)
            else:
                logging.warning(f"Scaler file not found at {self.scaler_path}")
                
            if os.path.exists(self.features_path):
                with open(self.features_path, 'rb') as f:
                    self.feature_cols = pickle.load(f)
            else:
                logging.warning(f"Feature cols file not found at {self.features_path}")
                
            if os.path.exists(self.data_path):
                self.df = pd.read_csv(self.data_path)
            else:
                logging.warning(f"Data file not found at {self.data_path}")
                
            logging.info("PredictionEngine initialized successfully.")
        except FileNotFoundError as e:
            logging.error(f"FileNotFoundError during initialization: {e}")
        except Exception as e:
            logging.error(f"Error during initialization: {e}")

    def predict(self, vital_signs_dict):
        if not self.model or not self.scaler or not self.feature_cols:
            return 0.0, "low", "Models not correctly loaded."
            
        try:
            input_data = [vital_signs_dict[col] for col in self.feature_cols]
            X = np.array(input_data).reshape(1, -1)
            X_scaled = self.scaler.transform(X)
            
            if hasattr(self.model, "predict_proba"):
                risk_score = float(self.model.predict_proba(X_scaled)[0, 1])
            else:
                risk_score = float(self.model.predict(X_scaled)[0])
                
            if risk_score > 0.6:
                alert_level = "high"
                alert_message = "High risk of IOH detected. Immediate attention recommended."
            elif risk_score >= 0.4:
                alert_level = "medium"
                alert_message = "Medium risk of IOH. Monitor closely."
            else:
                alert_level = "low"
                alert_message = "Patient is stable."
                
            return risk_score, alert_level, alert_message
        except Exception as e:
            logging.error(f"Prediction error: {e}")
            return 0.0, "low", f"Prediction error: {str(e)}"

    def explain(self, vital_signs_dict):
        if not self.model or not self.scaler or not self.feature_cols:
            return []
            
        try:
            input_data = [vital_signs_dict[col] for col in self.feature_cols]
            X = np.array(input_data).reshape(1, -1)
            X_scaled = self.scaler.transform(X)
            
            explainer = shap.LinearExplainer(self.model, shap.maskers.Independent(X_scaled))
            shap_values = explainer.shap_values(X_scaled)
            
            if isinstance(shap_values, list): 
                vals = shap_values[1][0]
            else:
                vals = shap_values[0]
                
            features_impact = []
            for i, col in enumerate(self.feature_cols):
                features_impact.append({
                    "name": col,
                    "value": float(vital_signs_dict[col]),
                    "impact": float(vals[i])
                })
                
            features_impact.sort(key=lambda x: abs(x["impact"]), reverse=True)
            return features_impact[:10]
        except Exception as e:
            logging.error(f"Explanation error: {e}")
            return []

    def get_patient_data(self, case_id):
        if self.df.empty:
            return []
        
        try:
            case_data = self.df[self.df['case_id'] == case_id]
            return case_data.to_dict(orient='records')
        except Exception as e:
            logging.error(f"Error fetching patient data: {e}")
            return []

    def get_analytics(self):
        if self.df.empty:
            return {
                "total_cases": 0, "total_rows": 0, "overall_ioh_rate": 0.0,
                "per_case": [], "map_distribution": {"bins": [], "counts": []},
                "risk_distribution": {"bins": [], "counts": []}
            }
            
        try:
            total_rows = len(self.df)
            case_col = 'case_id' if 'case_id' in self.df.columns else self.df.columns[0]
            total_cases = int(self.df[case_col].nunique())
            
            ioh_col = 'IOH' if 'IOH' in self.df.columns else ('ioh' if 'ioh' in self.df.columns else None)
            overall_ioh_rate = float(self.df[ioh_col].mean()) if ioh_col else 0.0
            
            if self.model and self.scaler and self.feature_cols and all(col in self.df.columns for col in self.feature_cols):
                X_all = self.df[self.feature_cols]
                X_all_scaled = self.scaler.transform(X_all)
                if hasattr(self.model, "predict_proba"):
                    self.df['risk_score'] = self.model.predict_proba(X_all_scaled)[:, 1]
                else:
                    self.df['risk_score'] = self.model.predict(X_all_scaled)
            else:
                self.df['risk_score'] = 0.0
                
            per_case = []
            if case_col in self.df.columns:
                for cid, group in self.df.groupby(case_col):
                    per_case.append({
                        "case_id": int(cid),
                        "row_count": len(group),
                        "ioh_rate": float(group[ioh_col].mean()) if ioh_col else 0.0,
                        "avg_risk": float(group['risk_score'].mean()),
                        "max_risk": float(group['risk_score'].max()),
                        "duration_minutes": len(group)
                    })
                    
            map_col = 'MAP_current' if 'MAP_current' in self.df.columns else None
            if map_col:
                map_counts, map_bins = np.histogram(self.df[map_col].dropna(), bins=20)
                map_distribution = {"bins": map_bins.tolist(), "counts": map_counts.tolist()}
            else:
                map_distribution = {"bins": [], "counts": []}
                
            risk_counts, risk_bins = np.histogram(self.df['risk_score'].dropna(), bins=20)
            risk_distribution = {"bins": risk_bins.tolist(), "counts": risk_counts.tolist()}
            
            return {
                "total_cases": total_cases,
                "total_rows": total_rows,
                "overall_ioh_rate": overall_ioh_rate,
                "per_case": per_case,
                "map_distribution": map_distribution,
                "risk_distribution": risk_distribution
            }
        except Exception as e:
            logging.error(f"Error computing analytics: {e}")
            return {
                "total_cases": 0, "total_rows": 0, "overall_ioh_rate": 0.0,
                "per_case": [], "map_distribution": {"bins": [], "counts": []},
                "risk_distribution": {"bins": [], "counts": []}
            }
