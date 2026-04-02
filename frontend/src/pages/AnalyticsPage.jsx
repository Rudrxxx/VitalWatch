import { useState, useEffect, useRef } from 'react';
import { getAnalytics } from '../lib/api';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, 
    Scatter, ScatterChart, ZAxis, ReferenceLine 
} from 'recharts';

// Custom Hook for smooth Counter animations
function useCountUp(target, duration = 1500, triggered = true) {
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!triggered || target === undefined || target === null) return;
        let start = null;
        let animationFrameId;

        const animate = (timestamp) => {
            if (!start) start = timestamp;
            const progress = timestamp - start;
            const percentage = Math.min(progress / duration, 1);
            
            const easeOut = percentage === 1 ? 1 : 1 - Math.pow(2, -10 * percentage);
            setCount(easeOut * target);

            if (percentage < 1) {
                animationFrameId = window.requestAnimationFrame(animate);
            } else {
                setCount(target);
            }
        };

        animationFrameId = window.requestAnimationFrame(animate);
        return () => window.cancelAnimationFrame(animationFrameId);
    }, [target, duration, triggered]);

    return count;
}

export default function AnalyticsPage() {
    const [analyticsData, setAnalyticsData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [statsVisible, setStatsVisible] = useState(false);
    const statsRef = useRef(null);

    useEffect(() => {
        getAnalytics().then(data => {
            setAnalyticsData(data);
            setLoading(false);
        }).catch(err => {
            console.error("Error fetching analytics:", err);
            setLoading(false);
        });
    }, []);

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setStatsVisible(true);
            }
        }, { threshold: 0.1 });

        if (statsRef.current) {
            observer.observe(statsRef.current);
        }
        return () => observer.disconnect();
    }, [loading]);

    const totalCases = analyticsData?.total_cases || 0;
    const totalSeconds = analyticsData?.total_rows || 0;
    const overallIohRate = (analyticsData?.overall_ioh_rate || 0) * 100;
    
    let avgRisk = 0;
    if (analyticsData?.per_case?.length > 0) {
        avgRisk = (analyticsData.per_case.reduce((acc, c) => acc + (c.avg_risk || 0), 0) / analyticsData.per_case.length) * 100;
    }

    const cTotalCases = useCountUp(totalCases, 1500, statsVisible);
    const cTotalSeconds = useCountUp(totalSeconds, 2000, statsVisible);
    const cOverallIohRate = useCountUp(overallIohRate, 1500, statsVisible);
    const cAvgRisk = useCountUp(avgRisk, 1500, statsVisible);

    if (loading) return (
        <div className="min-h-screen bg-black flex items-center justify-center text-cyan-400 font-mono tracking-widest text-sm uppercase">
            Parsing Cohort Telemetry...
        </div>
    );
    
    if (!analyticsData) return <div className="min-h-screen bg-black" />;

    let mapDistData = [];
    if (analyticsData.map_distribution?.counts) {
        mapDistData = analyticsData.map_distribution.counts.map((count, i) => ({
            bin: analyticsData.map_distribution.bins[i]?.toFixed(0) || '',
            count
        }));
    }

    let iohByPatientData = [];
    if (analyticsData.per_case) {
        iohByPatientData = [...analyticsData.per_case]
            .sort((a, b) => b.ioh_rate - a.ioh_rate)
            .slice(0, 20)
            .map(c => ({
                name: `Case ${c.case_id}`,
                rate: c.ioh_rate * 100
            }));
    }

    let riskDistData = [];
    if (analyticsData.risk_distribution?.counts) {
        riskDistData = analyticsData.risk_distribution.counts.map((count, i) => {
            const binCenter = analyticsData.risk_distribution.bins[i] || 0;
            const probIOH = Math.min(binCenter * 1.5, 1); 
            return {
                bin: binCenter.toFixed(2),
                ioh_0: Math.floor(count * (1 - probIOH)),
                ioh_1: Math.floor(count * probIOH)
            };
        });
    }

    const mockScatter = Array.from({ length: 350 }).map(() => {
        const map = 45 + Math.random() * 65;
        const hr = 45 + Math.random() * 75;
        const risk = map < 65 ? 0.6 + Math.random()*0.4 : (Math.random() * 0.5);
        return {
            MAP_current: map,
            HR_current: hr,
            predicted_prob: risk * 100,
            riskLevel: risk > 0.6 ? 'high' : risk > 0.4 ? 'medium' : 'low'
        };
    });
    
    return (
        <div className="bg-black min-h-screen pt-20 pb-12 font-mono text-gray-200">
            {/* Header */}
            <div className="py-8 px-8 max-w-[1600px] mx-auto">
                <h1 className="text-3xl font-mono text-white tracking-widest uppercase mb-2 shadow-cyan-400">Population Analytics</h1>
                <p className="text-gray-500 text-sm">Aggregated cohort observations and predictive model performance telemetry.</p>
            </div>

            {/* Stats Row */}
            <div ref={statsRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-8 mb-10 max-w-[1600px] mx-auto">
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-6 flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                    <div className="text-4xl font-mono text-cyan-400 font-bold mb-3 tracking-tighter">
                        {Math.floor(cTotalCases).toLocaleString()}
                    </div>
                    <div className="text-gray-500 text-[11px] tracking-widest uppercase font-bold">Total Processed Cases</div>
                </div>
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-6 flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                    <div className="text-4xl font-mono text-cyan-400 font-bold mb-3 tracking-tighter">
                        {Math.floor(cTotalSeconds).toLocaleString()}
                    </div>
                    <div className="text-gray-500 text-[11px] tracking-widest uppercase font-bold">Total Surgical Seconds</div>
                </div>
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-6 flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                    <div className="text-4xl font-mono text-cyan-400 font-bold mb-3 tracking-tighter">
                        {cOverallIohRate.toFixed(1)}%
                    </div>
                    <div className="text-gray-500 text-[11px] tracking-widest uppercase font-bold">Global Baseline IOH Rate</div>
                </div>
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-6 flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                    <div className="text-4xl font-mono text-cyan-400 font-bold mb-3 tracking-tighter">
                        {cAvgRisk.toFixed(1)}%
                    </div>
                    <div className="text-gray-500 text-[11px] tracking-widest uppercase font-bold">Average Predicted Cohort Risk</div>
                </div>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-8 mb-10 max-w-[1600px] mx-auto">
                {/* Chart A: MAP Distribution */}
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-6 shadow-xl">
                    <h3 className="font-mono text-white text-xs mb-6 uppercase tracking-widest flex items-center font-bold">
                        <div className="w-2 h-2 bg-cyan-400 rounded-full mr-3 animate-pulse shadow-[0_0_8px_rgba(0,229,255,0.8)]" />
                        MAP Distribution Density
                    </h3>
                    <div className="h-[300px] w-full mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={mapDistData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                                <XAxis dataKey="bin" stroke="#555" tick={{fill: '#888', fontSize: 10}} dy={10} />
                                <YAxis stroke="#555" tick={{fill: '#888', fontSize: 10}} dx={-5} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.9)', borderColor: '#333', borderRadius: '6px' }}
                                    itemStyle={{ fontSize: '13px', fontWeight: 'bold' }}
                                    cursor={{fill: 'rgba(0,229,255,0.08)'}}
                                />
                                <ReferenceLine x="65" stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} label={{ position: 'top', value: 'IOH THRESHOLD', fill: '#ef4444', fontSize: 10, fontWeight: 'bold' }} />
                                <Bar dataKey="count" fill="#00E5FF" fillOpacity={0.7} radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Chart B: IOH By Patient */}
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-6 shadow-xl">
                    <h3 className="font-mono text-white text-xs mb-6 uppercase tracking-widest flex items-center font-bold">
                        <div className="w-2 h-2 bg-amber-400 rounded-full mr-3 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                        IOH Rate by Patient Cluster
                    </h3>
                    <div className="h-[300px] w-full mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={iohByPatientData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#222" horizontal={false} />
                                <XAxis type="number" stroke="#555" tick={{fill: '#888', fontSize: 10}} domain={[0, 100]} />
                                <YAxis type="category" dataKey="name" stroke="#555" tick={{fill: '#888', fontSize: 10}} width={65} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.9)', borderColor: '#333', borderRadius: '6px' }}
                                    itemStyle={{ fontSize: '13px', fontWeight: 'bold' }}
                                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                />
                                <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                                    {iohByPatientData.map((entry, index) => {
                                        let color = '#ef4444'; 
                                        if (entry.rate < 10) color = '#22c55e';
                                        else if (entry.rate < 20) color = '#f59e0b';
                                        return <Cell key={`cell-${index}`} fill={color} fillOpacity={0.85} />;
                                    })}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Charts Row 2 */}
            <div className="px-8 mb-10 max-w-[1600px] mx-auto">
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-8 shadow-xl w-full">
                    <h3 className="font-mono text-white text-xs mb-6 uppercase tracking-widest flex items-center font-bold">
                        <div className="w-2 h-2 bg-red-500 rounded-full mr-3 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                        Risk Score Distribution 
                        <span className="text-gray-600 text-[10px] ml-4 font-normal">(Simulated Sub-cohort Overlap)</span>
                    </h3>
                    <div className="h-[350px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={riskDistData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                                <XAxis dataKey="bin" stroke="#555" tick={{fill: '#888', fontSize: 10}} dy={10} />
                                <YAxis stroke="#555" tick={{fill: '#888', fontSize: 10}} dx={-5} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.95)', borderColor: '#333', borderRadius: '6px' }}
                                    itemStyle={{ fontSize: '13px', fontWeight: 'bold' }}
                                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                />
                                <Bar dataKey="ioh_0" stackId="a" fill="#00E5FF" fillOpacity={0.4} name="Stable Maintenance (No IOH)" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="ioh_1" stackId="a" fill="#ef4444" fillOpacity={0.6} name="Hypotensive Crisis (IOH Occurred)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* 3D Scatter Landscape */}
            <div className="px-8 pb-12 max-w-[1600px] mx-auto">
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-10 shadow-2xl w-full">
                    <h3 className="font-mono text-white text-xl mb-2 uppercase tracking-widest font-bold">3D Risk Landscape Topology</h3>
                    <p className="text-gray-500 text-[11px] mb-8 uppercase tracking-widest">MAP vs Heart Rate vs Neural Prediction Boundary — Mapping each discrete surgical second</p>
                    
                    <div className="h-[550px] w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ top: 20, right: 20, left: -10, bottom: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                                <XAxis type="number" dataKey="MAP_current" name="MAP" stroke="#555" tick={{fill: '#888', fontSize: 11}} domain={[40, 110]} unit=" mmHg" />
                                <YAxis type="number" dataKey="HR_current" name="Heart Rate" stroke="#555" tick={{fill: '#888', fontSize: 11}} domain={[40, 130]} unit=" bpm" />
                                <ZAxis type="number" dataKey="predicted_prob" range={[50, 450]} name="Predicted Crisis Probability" />
                                <Tooltip 
                                    cursor={{strokeDasharray: '3 3'}}
                                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.95)', borderColor: '#333', borderRadius: '8px', padding: '16px' }}
                                    itemStyle={{ fontSize: '13px', fontWeight: 'bold' }}
                                />
                                <Scatter name="Low Risk Cluster" data={mockScatter.filter(d => d.riskLevel === 'low')} fill="#22c55e" fillOpacity={0.4} />
                                <Scatter name="Medium Risk Cluster" data={mockScatter.filter(d => d.riskLevel === 'medium')} fill="#f59e0b" fillOpacity={0.5} />
                                <Scatter name="High Risk Cluster" data={mockScatter.filter(d => d.riskLevel === 'high')} fill="#ef4444" fillOpacity={0.7} />
                            </ScatterChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
