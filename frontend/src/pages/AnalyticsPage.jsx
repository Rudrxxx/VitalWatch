import { useState, useEffect, useRef } from 'react';
import { getAnalytics } from '../lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine, ScatterChart,
  Scatter, ZAxis
} from 'recharts';

function useCountUp(target, duration = 1500, triggered = true) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!triggered || !target) return;
    let start = null;
    let id;
    const animate = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(2, -10 * p);
      setCount(ease * target);
      if (p < 1) id = requestAnimationFrame(animate);
      else setCount(target);
    };
    id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(id);
  }, [target, duration, triggered]);
  return count;
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-950 border border-gray-700 rounded px-3 py-2 text-xs font-mono">
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</div>
      ))}
    </div>
  );
};

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [visible, setVisible] = useState(false);
  const statsRef = useRef(null);

  useEffect(() => {
    getAnalytics()
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.1 });
    if (statsRef.current) obs.observe(statsRef.current);
    return () => obs.disconnect();
  }, [loading]);

  const totalCases = data?.total_cases || 0;
  const totalRows = data?.total_rows || 0;
  const iohRate = ((data?.overall_ioh_rate || 0) * 100);
  const avgRisk = data?.per_case?.length
    ? (data.per_case.reduce((a, c) => a + (c.avg_risk || 0), 0) / data.per_case.length) * 100
    : 0;

  const cCases = useCountUp(totalCases, 1500, visible);
  const cRows = useCountUp(totalRows, 2000, visible);
  const cIoh = useCountUp(iohRate, 1500, visible);
  const cRisk = useCountUp(avgRisk, 1500, visible);

  // MAP histogram data
  const mapHistData = data?.map_distribution?.bins?.length
    ? data.map_distribution.bins.slice(0, -1).map((b, i) => ({
        range: `${Math.round(b)}-${Math.round(data.map_distribution.bins[i + 1])}`,
        count: data.map_distribution.counts[i] || 0,
      }))
    : [];

  // IOH per patient (top 20 by ioh_rate)
  const iohPerPatient = data?.per_case
    ? [...data.per_case].sort((a, b) => b.ioh_rate - a.ioh_rate).slice(0, 20).map(c => ({
        name: `#${c.case_id}`,
        ioh: (c.ioh_rate * 100).toFixed(1),
        color: c.ioh_rate < 0.1 ? '#22c55e' : c.ioh_rate < 0.2 ? '#f59e0b' : '#ef4444',
      }))
    : [];

  // Risk distribution
  const riskHistData = data?.risk_distribution?.bins?.length
    ? data.risk_distribution.bins.slice(0, -1).map((b, i) => ({
        range: b.toFixed(2),
        count: data.risk_distribution.counts[i] || 0,
      }))
    : [];

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-cyan-400 font-mono text-sm animate-pulse">Loading analytics...</div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-red-400 font-mono text-sm">Error: {error}<br />Is the backend running on port 8000?</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black pt-16">
      {/* Header */}
      <div className="border-b border-gray-900 px-8 py-10">
        <div className="text-xs text-cyan-400 tracking-widest uppercase mb-2">Population Intelligence</div>
        <h1 className="text-3xl font-bold text-white font-mono">Analytics Observatory</h1>
        <p className="text-gray-500 text-sm mt-1">Aggregated insights from {totalCases} surgical cases · {totalRows.toLocaleString()} data points</p>
      </div>

      {/* Stats row */}
      <div ref={statsRef} className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-900 border-b border-gray-900">
        {[
          { label: 'Total Cases', val: Math.floor(cCases), suffix: '' },
          { label: 'Data Points', val: Math.floor(cRows).toLocaleString(), suffix: '' },
          { label: 'Overall IOH Rate', val: cIoh.toFixed(1), suffix: '%' },
          { label: 'Avg Risk Score', val: cRisk.toFixed(1), suffix: '%' },
        ].map(({ label, val, suffix }) => (
          <div key={label} className="bg-black px-8 py-8">
            <div className="text-4xl font-mono text-cyan-400 font-bold">{val}{suffix}</div>
            <div className="text-gray-500 text-xs uppercase tracking-widest mt-2">{label}</div>
          </div>
        ))}
      </div>

      <div className="px-8 py-8 space-y-6">
        {/* Row 1: MAP Distribution + IOH per Patient */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* MAP Distribution */}
          <div className="bg-gray-950 border border-gray-800 rounded-lg p-6">
            <div className="text-xs text-cyan-400 tracking-widest uppercase mb-1">MAP Distribution</div>
            <div className="text-gray-500 text-xs mb-4">Mean Arterial Pressure across all surgical seconds</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={mapHistData} margin={{ top: 5, right: 5, left: -20, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#111" vertical={false} />
                <XAxis dataKey="range" stroke="#444" tick={{ fill: '#555', fontSize: 9 }} angle={-45} textAnchor="end" />
                <YAxis stroke="#444" tick={{ fill: '#555', fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine x="60-68" stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'IOH', fill: '#ef4444', fontSize: 10 }} />
                <Bar dataKey="count" fill="#00E5FF" opacity={0.7} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* IOH Rate per Patient */}
          <div className="bg-gray-950 border border-gray-800 rounded-lg p-6">
            <div className="text-xs text-cyan-400 tracking-widest uppercase mb-1">IOH Rate by Patient</div>
            <div className="text-gray-500 text-xs mb-4">Top 20 cases sorted by hypotension frequency</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={iohPerPatient} layout="vertical" margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#111" horizontal={false} />
                <XAxis type="number" stroke="#444" tick={{ fill: '#555', fontSize: 10 }} unit="%" />
                <YAxis type="category" dataKey="name" stroke="#444" tick={{ fill: '#666', fontSize: 9 }} width={30} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="ioh" radius={[0, 2, 2, 0]}>
                  {iohPerPatient.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full inline-block"/> &lt;10%</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-500 rounded-full inline-block"/> 10–20%</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-full inline-block"/> &gt;20%</span>
            </div>
          </div>
        </div>

        {/* Row 2: Risk Distribution */}
        <div className="bg-gray-950 border border-gray-800 rounded-lg p-6">
          <div className="text-xs text-cyan-400 tracking-widest uppercase mb-1">Risk Score Distribution</div>
          <div className="text-gray-500 text-xs mb-4">Predicted IOH probability across all data points</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={riskHistData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#111" vertical={false} />
              <XAxis dataKey="range" stroke="#444" tick={{ fill: '#555', fontSize: 10 }} />
              <YAxis stroke="#444" tick={{ fill: '#555', fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                {riskHistData.map((entry, i) => {
                  const val = parseFloat(entry.range);
                  const color = val > 0.6 ? '#ef4444' : val > 0.4 ? '#f59e0b' : '#00E5FF';
                  return <Cell key={i} fill={color} opacity={0.7} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Row 3: Per-case risk summary table */}
        <div className="bg-gray-950 border border-gray-800 rounded-lg p-6">
          <div className="text-xs text-cyan-400 tracking-widest uppercase mb-4">Case Summary Table</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 uppercase tracking-widest">
                  <th className="text-left py-2 pr-4">Case ID</th>
                  <th className="text-right py-2 pr-4">Duration (rows)</th>
                  <th className="text-right py-2 pr-4">IOH Rate</th>
                  <th className="text-right py-2 pr-4">Avg Risk</th>
                  <th className="text-right py-2">Max Risk</th>
                </tr>
              </thead>
              <tbody>
                {(data?.per_case || []).map(c => (
                  <tr key={c.case_id} className="border-b border-gray-900 hover:bg-gray-900 transition-colors">
                    <td className="py-1.5 pr-4 text-cyan-400">#{c.case_id}</td>
                    <td className="py-1.5 pr-4 text-right text-gray-400">{c.row_count?.toLocaleString()}</td>
                    <td className="py-1.5 pr-4 text-right" style={{ color: c.ioh_rate > 0.2 ? '#ef4444' : c.ioh_rate > 0.1 ? '#f59e0b' : '#22c55e' }}>
                      {((c.ioh_rate || 0) * 100).toFixed(1)}%
                    </td>
                    <td className="py-1.5 pr-4 text-right text-gray-300">{((c.avg_risk || 0) * 100).toFixed(1)}%</td>
                    <td className="py-1.5 text-right text-gray-300">{((c.max_risk || 0) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
