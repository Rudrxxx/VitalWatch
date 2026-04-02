import { useState, useEffect, useRef, useCallback } from 'react';
import { getAnalytics, getPatient, predict, explain } from '../lib/api';
import AlertBanner from '../components/AlertBanner';
import { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
    ReferenceLine, ResponsiveContainer 
} from 'recharts';
import { Play, Pause } from 'lucide-react';

export default function MonitorPage() {
    const [cases, setCases] = useState([]);
    const [selectedCase, setSelectedCase] = useState(null);
    const [patientData, setPatientData] = useState([]);
    
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeed] = useState(1);
    
    const [currentVitals, setCurrentVitals] = useState({ MAP: 0, HR: 0, SpO2: 0 });
    const [riskScore, setRiskScore] = useState(0);
    const [alertLevel, setAlertLevel] = useState("low");
    
    const [chartData, setChartData] = useState([]);
    const [shapFeatures, setShapFeatures] = useState([]);
    
    const stepCountRef = useRef(0);

    const loadCase = useCallback(async (cid) => {
        setSelectedCase(cid);
        setIsPlaying(false);
        try {
            const data = await getPatient(cid);
            setPatientData(data);
            setCurrentIndex(0);
            setChartData([]);
            setShapFeatures([]);
            stepCountRef.current = 0;
            setRiskScore(0);
            setAlertLevel("low");
            setCurrentVitals({ MAP: 0, HR: 0, SpO2: 0 });
            
            if (data.length > 0) {
                processRow(data[0], 0);
            }
        } catch (e) {
            console.error("Failed to load patient:", e);
        }
    }, []);

    useEffect(() => {
        getAnalytics().then(data => {
            if (data && data.per_case) {
                const caseIds = data.per_case.map(c => c.case_id);
                setCases(caseIds);
                if (caseIds.length > 0) {
                    loadCase(caseIds[0]);
                }
            }
        }).catch(console.error);
    }, [loadCase]);

    const processRow = async (row, index) => {
        setCurrentVitals({
            MAP: row.MAP_current || 0,
            HR: row.HR_current || 0,
            SpO2: row.SpO2_current || 0
        });

        try {
            const predRes = await predict(row);
            setRiskScore(predRes.risk_score);
            setAlertLevel(predRes.alert_level);

            setChartData(prev => {
                const newPoint = {
                    time: index,
                    MAP: row.MAP_current || 0,
                    HR: row.HR_current || 0,
                    SpO2: row.SpO2_current || 0
                };
                const newData = [...prev, newPoint];
                return newData.length > 300 ? newData.slice(-300) : newData;
            });

            stepCountRef.current += 1;
            if (stepCountRef.current % 5 === 0 || stepCountRef.current === 1) {
                const explRes = await explain(row);
                if (explRes && explRes.top_features) {
                    setShapFeatures(explRes.top_features);
                }
            }
        } catch (e) {
            console.error("Prediction/Explanation API error:", e);
        }
    };

    useEffect(() => {
        let interval;
        if (isPlaying && patientData.length > 0) {
            interval = setInterval(() => {
                setCurrentIndex(prev => {
                    const nextIndex = prev + speed;
                    if (nextIndex >= patientData.length) {
                        setIsPlaying(false);
                        return prev;
                    }
                    return nextIndex;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isPlaying, speed, patientData.length]);

    useEffect(() => {
        if (patientData.length > 0 && currentIndex > 0 && isPlaying) {
            processRow(patientData[currentIndex], currentIndex);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentIndex, patientData, isPlaying]);

    const minutes = Math.floor(currentIndex / 60).toString().padStart(2, '0');
    const seconds = (currentIndex % 60).toString().padStart(2, '0');
    
    // Risk visual parameters
    const riskPercent = riskScore * 100;
    let riskColor = "text-white";
    let badgeColor = "bg-gray-800 text-white";
    let badgeText = "NORMAL";
    
    if (alertLevel === "high") {
        riskColor = "text-red-500";
        badgeColor = "bg-red-500 text-white";
        badgeText = "HIGH RISK (CRITICAL)";
    } else if (alertLevel === "medium") {
        riskColor = "text-amber-400";
        badgeColor = "bg-amber-500 text-black";
        badgeText = "MEDIUM RISK";
    } else {
        badgeColor = "bg-cyan-500 text-black";
        badgeText = "STABLE";
    }

    return (
        <div className="bg-black min-h-screen pt-[68px] flex flex-col font-mono text-gray-200">
            {/* Control bar */}
            <div className="bg-gray-950 border-b border-gray-800 px-6 py-3 flex items-center justify-between shadow-lg z-10 shrink-0">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-sm">CASE:</span>
                        <select 
                            className="bg-black text-cyan-400 border border-gray-800 px-3 py-1 font-mono text-sm rounded outline-none cursor-pointer"
                            value={selectedCase || ''}
                            onChange={(e) => loadCase(parseInt(e.target.value))}
                        >
                            {cases.map(c => <option key={c} value={c}>#{c}</option>)}
                        </select>
                    </div>
                    
                    <div className="w-px h-6 bg-gray-800 hidden sm:block" />
                    
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setIsPlaying(!isPlaying)}
                            className={`p-2 rounded transition ${isPlaying ? 'bg-cyan-900 text-cyan-400 shadow-[0_0_10px_rgba(0,229,255,0.5)]' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                        >
                            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                        </button>
                        
                        <div className="flex items-center bg-gray-900 rounded overflow-hidden border border-gray-800 ml-2">
                            {[1, 5, 10].map(s => (
                                <button
                                    key={s}
                                    onClick={() => setSpeed(s)}
                                    className={`px-3 py-1 text-xs transition border-r border-gray-800 last:border-0 ${speed === s ? 'bg-cyan-600 text-white font-bold' : 'text-gray-400 hover:bg-gray-800'}`}
                                >
                                    {s}x
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <span className="text-gray-500 text-xs sm:text-sm">TIME OFFSET</span>
                    <div className="bg-black px-3 py-1 border border-gray-800 rounded text-cyan-400 font-bold tracking-widest text-lg">
                        {minutes}:{seconds}
                    </div>
                </div>
            </div>

            <AlertBanner shown={alertLevel === "high"} />

            {/* Main grid */}
            <div className="flex-1 grid grid-cols-12 gap-0 overflow-y-auto sm:overflow-hidden">
                {/* Left panel */}
                <div className="col-span-12 lg:col-span-3 bg-gray-950 border-r border-gray-800 p-6 flex flex-col justify-between shrink-0">
                    <div>
                        <div className="mb-6">
                            <div className="text-gray-500 text-xs tracking-widest mb-1">MAP (mmHg)</div>
                            <div className="text-5xl font-mono text-cyan-400 font-bold">
                                {currentVitals.MAP ? currentVitals.MAP.toFixed(1) : "0.0"}
                            </div>
                        </div>
                        <div className="mb-6">
                            <div className="text-gray-500 text-xs tracking-widest mb-1">HR (bpm)</div>
                            <div className="text-5xl font-mono text-white font-bold">
                                {currentVitals.HR ? currentVitals.HR.toFixed(1) : "0.0"}
                            </div>
                        </div>
                        <div className="mb-6">
                            <div className="text-gray-500 text-xs tracking-widest mb-1">SpO2 (%)</div>
                            <div className="text-5xl font-mono text-green-400 font-bold">
                                {currentVitals.SpO2 ? currentVitals.SpO2.toFixed(1) : "0.0"}
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-8 border-t border-gray-800">
                        <div className="text-gray-500 text-xs tracking-widest mb-2 font-bold">LIVE RISK SCORE</div>
                        <div className={`text-6xl font-mono font-bold transition-colors duration-500 ${riskColor}`}>
                            {riskPercent.toFixed(1)}%
                        </div>
                        <div className={`mt-5 px-4 py-2 rounded-full inline-block text-xs uppercase tracking-widest font-bold shadow-lg transition-colors duration-500 ${badgeColor}`}>
                            {badgeText}
                        </div>
                    </div>
                </div>

                {/* Center panel */}
                <div className="col-span-12 lg:col-span-6 bg-black p-6 flex flex-col min-h-[400px]">
                    <div className="text-cyan-400 uppercase tracking-widest text-xs mb-6 font-bold flex items-center">
                        <div className="w-2 h-2 bg-cyan-400 rounded-full mr-2 animate-pulse" />
                        Vital Signs Timeline
                    </div>
                    
                    <div className="flex-1 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                                <XAxis dataKey="time" stroke="#555" tick={{fill: '#888', fontSize: 12}} dy={10} />
                                <YAxis stroke="#555" tick={{fill: '#888', fontSize: 12}} domain={['auto', 'auto']} dx={-5} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.9)', borderColor: '#333', borderRadius: '8px', color: '#fff' }}
                                    itemStyle={{ fontSize: '14px', fontWeight: 'bold' }}
                                />
                                <ReferenceLine y={65} stroke="red" strokeDasharray="5 5" strokeWidth={1} label={{ position: 'insideTopLeft', value: 'MAP CRITICAL (65)', fill: 'red', fontSize: 10 }} />
                                
                                <Line type="monotone" dataKey="MAP" stroke="#00E5FF" strokeWidth={2} dot={false} isAnimationActive={false} />
                                <Line type="monotone" dataKey="HR" stroke="#FFFFFF" strokeWidth={1.5} dot={false} isAnimationActive={false} opacity={0.6} />
                                <Line type="monotone" dataKey="SpO2" stroke="#4ADE80" strokeWidth={1.5} dot={false} isAnimationActive={false} opacity={0.6} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Right panel */}
                <div className="col-span-12 lg:col-span-3 bg-gray-950 border-l border-gray-800 p-6 overflow-y-auto min-h-[300px]">
                    <div className="text-cyan-400 uppercase tracking-widest text-xs mb-6 font-bold flex items-center justify-between">
                        Risk Context
                        <span className="bg-gray-800 text-gray-400 px-2 py-0.5 rounded text-[10px]">SHAP</span>
                    </div>

                    <div className="flex flex-col gap-4 mt-2">
                        {shapFeatures.length === 0 ? (
                            <div className="text-gray-600 text-xs italic mt-4">Computing real-time SHAP topology...</div>
                        ) : null}
                        
                        {shapFeatures.map(f => {
                            const isPos = f.impact > 0;
                            const colorClass = isPos ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]';
                            const maxImpact = Math.max(...shapFeatures.map(x => Math.abs(x.impact)), 0.001);
                            const widthPct = (Math.abs(f.impact) / maxImpact) * 100;
                            
                            return (
                                <div key={f.name} className="flex flex-col mb-1 group">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="text-gray-400 text-xs truncate mr-2 font-mono group-hover:text-white transition-colors" title={f.name}>
                                            {f.name.substring(0, 15)}
                                        </div>
                                        <div className="w-10 text-right text-xs font-bold font-mono text-gray-300">
                                            {isPos ? "+" : ""}{f.impact.toFixed(2)}
                                        </div>
                                    </div>
                                    <div className="w-full h-1.5 bg-black rounded overflow-hidden relative">
                                        <div className={`${colorClass} h-full rounded transition-all duration-300`} style={{ width: `${widthPct}%` }} />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
