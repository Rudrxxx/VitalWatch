import { useState, useEffect, useRef } from 'react';
import { ragQuery, getRagSuggestions, getPatient, getAnalytics } from '../lib/api';
import { Send, Bot, User, AlertCircle } from 'lucide-react';

function TypewriterText({ text }) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    let i = 0;
    setDisplayed('');
    const iv = setInterval(() => {
      if (i < text.length) { setDisplayed(text.slice(0, ++i)); }
      else clearInterval(iv);
    }, 12);
    return () => clearInterval(iv);
  }, [text]);
  return <span>{displayed}<span className="cursor-blink opacity-70">▌</span></span>;
}

export default function ChatbotPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [patientMode, setPatientMode] = useState(false);
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState('');
  const [patientStats, setPatientStats] = useState(null);
  const [ragOffline, setRagOffline] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    getRagSuggestions().then(setSuggestions).catch(() => {});
    getAnalytics().then(d => {
      if (d?.per_case) setCases(d.per_case);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleCaseSelect = async (e) => {
    const id = parseInt(e.target.value);
    setSelectedCase(id);
    if (!id) { setPatientStats(null); return; }
    const caseObj = cases.find(c => c.case_id === id);
    try {
      const rows = await getPatient(id);
      const n = Math.min(100, rows.length);
      const slice = rows.slice(0, n);
      setPatientStats({
        MAP: (slice.reduce((a, r) => a + (r.MAP_current || 0), 0) / n).toFixed(1),
        HR: (slice.reduce((a, r) => a + (r.HR_current || 0), 0) / n).toFixed(1),
        SpO2: (slice.reduce((a, r) => a + (r.SpO2_current || 0), 0) / n).toFixed(1),
        ioh: caseObj ? ((caseObj.ioh_rate || 0) * 100).toFixed(1) : '0.0',
        maxRisk: caseObj ? ((caseObj.max_risk || 0) * 100).toFixed(1) : '0.0',
      });
    } catch { setPatientStats(null); }
  };

  const send = async (text) => {
    if (!text.trim() || loading) return;
    setShowSuggestions(false);
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text }]);
    setLoading(true);

    let ctx = null;
    if (patientMode && patientStats) {
      ctx = `Current patient vitals — MAP: ${patientStats.MAP} mmHg, HR: ${patientStats.HR} bpm, SpO2: ${patientStats.SpO2}%, IOH rate: ${patientStats.ioh}%, Max risk score: ${patientStats.maxRisk}%`;
    }

    try {
      const res = await ragQuery(text, ctx);
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: res.answer,
        sources: res.sources || [],
        latency: res.latency_ms,
        faithfulness: res.evaluation?.faithfulness_score,
      }]);
      setRagOffline(false);
    } catch (e) {
      const isOffline = e?.response?.status === 503;
      setRagOffline(isOffline);
      setMessages(prev => [...prev, {
        role: 'error',
        text: isOffline
          ? 'RAG pipeline is offline. Add your OPENAI_API_KEY to the .env file and restart the backend.'
          : `Error: ${e.message}`,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  return (
    <div className="h-screen bg-black flex flex-col pt-16">
      <div className="flex flex-1 overflow-hidden">
        {/* Chat area */}
        <div className="flex-1 flex flex-col border-r border-gray-900">
          {/* Header */}
          <div className="border-b border-gray-900 px-6 py-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-cyan-400 tracking-widest uppercase">Clinical Intelligence</div>
              <div className="text-white font-bold font-mono mt-0.5">RAG Medical Assistant</div>
            </div>
            <div className={`text-xs px-3 py-1 rounded-full border font-mono ${ragOffline ? 'border-red-500 text-red-400' : 'border-cyan-400/30 text-cyan-400'}`}>
              {ragOffline ? '● OFFLINE' : '● FAISS + GPT-4o-mini'}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {showSuggestions && messages.length === 0 && (
              <div>
                <div className="text-gray-600 text-xs uppercase tracking-widest mb-4">Suggested Questions</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => send(s)}
                      className="text-left border border-gray-800 text-gray-400 text-xs p-3 rounded hover:border-cyan-400/50 hover:text-cyan-400 hover:bg-cyan-400/5 transition font-mono leading-relaxed"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role !== 'user' && (
                  <div className="w-7 h-7 rounded-full bg-gray-900 border border-gray-700 flex items-center justify-center flex-shrink-0 mt-1">
                    {msg.role === 'error' ? <AlertCircle size={14} className="text-red-400" /> : <Bot size={14} className="text-cyan-400" />}
                  </div>
                )}
                <div className={`max-w-2xl ${msg.role === 'user' ? 'order-first' : ''}`}>
                  {msg.role === 'user' ? (
                    <div className="bg-white text-black rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm font-mono">
                      {msg.text}
                    </div>
                  ) : msg.role === 'error' ? (
                    <div className="bg-red-950/50 border border-red-900 rounded-xl px-4 py-3 text-red-400 text-xs font-mono leading-relaxed">
                      {msg.text}
                    </div>
                  ) : (
                    <div className="bg-gray-950 border-l-4 border-cyan-400 rounded-r-xl px-4 py-3">
                      <div className="text-gray-200 text-sm font-mono leading-relaxed">
                        {i === messages.length - 1 && !loading
                          ? <TypewriterText text={msg.text} />
                          : msg.text}
                      </div>
                      {msg.sources?.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {msg.sources.map((s, j) => (
                            <span key={j} className="text-xs bg-cyan-400/10 text-cyan-400 border border-cyan-400/20 px-2 py-0.5 rounded font-mono">
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                      {(msg.latency || msg.faithfulness != null) && (
                        <div className="mt-2 flex gap-3 text-xs text-gray-600 font-mono">
                          {msg.latency && <span>⏱ {(msg.latency / 1000).toFixed(2)}s</span>}
                          {msg.faithfulness != null && <span>Faithfulness: {msg.faithfulness.toFixed(2)}</span>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center flex-shrink-0 mt-1">
                    <User size={14} className="text-black" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="w-7 h-7 rounded-full bg-gray-900 border border-gray-700 flex items-center justify-center flex-shrink-0">
                  <Bot size={14} className="text-cyan-400" />
                </div>
                <div className="bg-gray-950 border-l-4 border-cyan-400 rounded-r-xl px-4 py-3">
                  <div className="flex gap-1 items-center h-5">
                    {[0, 1, 2].map(j => (
                      <span key={j} className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: `${j * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-900 px-6 py-4 flex gap-3">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a clinical question..."
              className="flex-1 bg-gray-950 border border-gray-800 text-white rounded-lg px-4 py-3 text-sm font-mono resize-none focus:outline-none focus:border-cyan-400 transition placeholder-gray-700"
            />
            <button
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              className="bg-cyan-400 text-black px-5 rounded-lg font-bold hover:bg-cyan-300 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send size={16} />
            </button>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="w-72 bg-gray-950 flex flex-col border-l border-gray-900 overflow-y-auto">
          <div className="p-5 border-b border-gray-900">
            <div className="text-xs text-gray-500 uppercase tracking-widest mb-3">Context Mode</div>
            <div className="flex gap-2">
              {['General', 'Patient'].map(m => (
                <button
                  key={m}
                  onClick={() => setPatientMode(m === 'Patient')}
                  className={`flex-1 py-2 text-xs font-mono rounded transition ${patientMode === (m === 'Patient')
                    ? 'bg-cyan-400 text-black font-bold'
                    : 'border border-gray-700 text-gray-400 hover:border-gray-600'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {patientMode && (
            <div className="p-5 border-b border-gray-900">
              <div className="text-xs text-gray-500 uppercase tracking-widest mb-3">Select Case</div>
              <select
                value={selectedCase}
                onChange={handleCaseSelect}
                className="w-full bg-black border border-gray-700 text-cyan-400 text-xs font-mono rounded px-3 py-2 focus:outline-none focus:border-cyan-400"
              >
                <option value="">-- select case --</option>
                {cases.map(c => <option key={c.case_id} value={c.case_id}>Case #{c.case_id}</option>)}
              </select>

              {patientStats && (
                <div className="mt-4 space-y-2">
                  {[
                    { label: 'Avg MAP', val: `${patientStats.MAP} mmHg`, color: 'text-cyan-400' },
                    { label: 'Avg HR', val: `${patientStats.HR} bpm`, color: 'text-white' },
                    { label: 'Avg SpO2', val: `${patientStats.SpO2}%`, color: 'text-green-400' },
                    { label: 'IOH Rate', val: `${patientStats.ioh}%`, color: 'text-amber-400' },
                    { label: 'Max Risk', val: `${patientStats.maxRisk}%`, color: 'text-red-400' },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="bg-black rounded p-3 flex justify-between items-center">
                      <span className="text-gray-500 text-xs">{label}</span>
                      <span className={`font-mono font-bold text-sm ${color}`}>{val}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="p-5 mt-auto">
            <div className="bg-black border border-gray-800 rounded p-4 text-xs text-gray-600 font-mono leading-relaxed">
              <div className="text-gray-500 mb-2 font-bold">About this assistant</div>
              RAG pipeline grounded in 16 anesthesia guidelines. Powered by GPT-4o-mini + FAISS vector search.
              Answers are clinically contextualized and source-cited.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
