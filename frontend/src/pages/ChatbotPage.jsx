import { useState, useEffect, useRef } from 'react';
import { ragQuery, getRagSuggestions, getPatient, getAnalytics } from '../lib/api';
import { Send, User, Bot, Loader2, FileText, Activity } from 'lucide-react';

function TypewriterText({ text, setIsTyping }) {
    const [displayed, setDisplayed] = useState('');
    
    useEffect(() => {
        let i = 0;
        setDisplayed('');
        setIsTyping(true);
        const interval = setInterval(() => {
            if (i < text.length) {
                setDisplayed(prev => prev + text.charAt(i));
                i++;
            } else {
                clearInterval(interval);
                setIsTyping(false);
            }
        }, 15); // Fast typewriter for usability
        return () => {
            clearInterval(interval);
            setIsTyping(false);
        };
    }, [text, setIsTyping]);

    return <span>{displayed}</span>;
}

export default function ChatbotPage() {
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(true);
    
    const [patientMode, setPatientMode] = useState(false);
    const [selectedCase, setSelectedCase] = useState('');
    const [patientStats, setPatientStats] = useState(null);
    const [cases, setCases] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    
    const messagesEndRef = useRef(null);

    useEffect(() => {
        getRagSuggestions().then(data => setSuggestions(data)).catch(console.error);
        getAnalytics().then(data => {
            if (data?.per_case) {
                setCases(data.per_case);
            }
        }).catch(console.error);
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping, isLoading]);

    const handlePatientSelect = async (e) => {
        const id = parseInt(e.target.value);
        setSelectedCase(id);
        if (!id) {
            setPatientStats(null);
            return;
        }
        
        const caseObj = cases.find(c => c.case_id === id);
        try {
            const Pdata = await getPatient(id);
            if (Pdata.length > 0) {
                const limit = Math.min(100, Pdata.length);
                const slice = Pdata.slice(0, limit);
                const avgMap = (slice.reduce((acc, r) => acc + (r.MAP_current || 0), 0) / limit).toFixed(1);
                const avgHr = (slice.reduce((acc, r) => acc + (r.HR_current || 0), 0) / limit).toFixed(1);
                const avgSpo2 = (slice.reduce((acc, r) => acc + (r.SpO2_current || 0), 0) / limit).toFixed(1);
                const ioh = caseObj ? (caseObj.ioh_rate * 100).toFixed(1) : "0.0";
                
                setPatientStats({
                    MAP: avgMap,
                    HR: avgHr,
                    SpO2: avgSpo2,
                    IOHRate: ioh
                });
            }
        } catch (e) {
            console.error("Failed to load generic stats for selected patient case", e);
        }
    };

    const sendMessage = async (text) => {
        if (!text.trim()) return;
        
        const newMsg = { id: Date.now(), role: 'user', text };
        setMessages(prev => [...prev, newMsg]);
        setInputText('');
        setIsLoading(true);
        setShowSuggestions(false);
        
        let context = null;
        if (patientMode && patientStats) {
            context = `Current patient vitals — MAP: ${patientStats.MAP}, HR: ${patientStats.HR}, SpO2: ${patientStats.SpO2}, IOH rate: ${patientStats.IOHRate}%`;
        }
        
        try {
            const res = await ragQuery(text, context);
            const faithfulness = res.evaluation?.faithfulness_score?.toFixed(2) || "N/A";
            const latencySec = (res.latency_ms / 1000).toFixed(2);
            
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                role: 'assistant',
                text: res.answer,
                sources: res.sources || [],
                latency: latencySec,
                faithfulness: faithfulness
            }]);
        } catch (e) {
            console.error(e);
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                role: 'assistant',
                text: "CRITICAL PIPELINE ERROR: Experienced an issue connecting to the inference engine or FAISS vector store. Please review application logs."
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(inputText);
        }
    };

    return (
        <div className="bg-black min-h-screen pt-[68px] flex font-mono text-gray-200 overflow-hidden">
            {/* Left Panel: Chat Core */}
            <div className="flex-1 flex flex-col border-r border-gray-800 h-[calc(100vh-68px)] relative">
                
                {/* Scrollable Chat Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {showSuggestions && messages.length === 0 && (
                        <div className="max-w-4xl mx-auto w-full mt-4 animate-in fade-in duration-500">
                            <h2 className="text-gray-500 mb-4 bg-gray-950 px-4 py-2 border border-gray-800 rounded font-bold uppercase tracking-widest text-xs inline-flex items-center">
                                <Activity size={14} className="mr-2" />
                                Suggested Questions
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {suggestions.map((s, i) => (
                                    <button
                                        key={i}
                                        onClick={() => sendMessage(s)}
                                        className="border border-gray-800 bg-black text-gray-400 text-sm p-4 rounded text-left hover:border-cyan-400 hover:text-cyan-400 hover:bg-[#00E5FF]/5 transition-all leading-relaxed shadow-sm hover:shadow"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="max-w-4xl mx-auto md:px-4 space-y-8 w-full">
                        {messages.map((m) => (
                            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {m.role === 'assistant' && (
                                    <div className="w-8 h-8 rounded-full bg-cyan-950 border border-cyan-400 flex items-center justify-center mr-3 mt-1 shrink-0 shadow-[0_0_8px_rgba(6,182,212,0.3)]">
                                        <Bot size={16} className="text-cyan-400" />
                                    </div>
                                )}
                                
                                <div className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                                    <div 
                                        className={`${m.role === 'user' 
                                            ? 'bg-white text-black px-5 py-3 shadow-[0_4px_10px_rgba(255,255,255,0.05)] whitespace-pre-wrap' 
                                            : 'bg-gray-950 text-gray-100 border-l-4 border-cyan-400 px-5 py-4 whitespace-pre-wrap leading-relaxed border-y border-r border-gray-800 shadow-[0_4px_20px_rgba(0,0,0,0.5)]'} 
                                            max-w-[16rem] sm:max-w-md md:max-w-2xl lg:max-w-3xl overflow-hidden`}
                                        style={{ 
                                            fontFamily: m.role === 'user' ? 'Inter, sans-serif' : undefined,
                                            borderTopLeftRadius: '1.25rem',
                                            borderTopRightRadius: '1.25rem',
                                            borderBottomLeftRadius: m.role === 'user' ? '1.25rem' : '0.25rem',
                                            borderBottomRightRadius: m.role === 'user' ? '0.25rem' : '1.25rem'
                                        }}
                                    >
                                        {m.role === 'assistant' && m.id === messages[messages.length - 1].id ? (
                                            <TypewriterText text={m.text} setIsTyping={setIsTyping} />
                                        ) : (
                                            <span>{m.text}</span>
                                        )}
                                    </div>

                                    {m.role === 'assistant' && m.sources && m.sources.length > 0 && !(m.id === messages[messages.length - 1].id && isTyping) && (
                                        <div className="mt-3 flex flex-wrap gap-2 max-w-2xl lg:max-w-3xl ml-2 animate-in fade-in duration-500">
                                            {m.sources.map((src, i) => (
                                                <span key={i} className="bg-cyan-950 text-cyan-400 text-[10px] uppercase tracking-widest px-2 py-1 rounded border border-cyan-400/20 flex items-center shadow-sm">
                                                    <FileText size={10} className="mr-1.5" /> {src}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {m.role === 'assistant' && m.latency && !(m.id === messages[messages.length - 1].id && isTyping) && (
                                        <div className="mt-2 text-gray-600 text-[10px] ml-3 tracking-widest flex gap-3 uppercase font-bold animate-in fade-in duration-500">
                                            <span>Response: {m.latency}s</span>
                                            <span className="opacity-50">&middot;</span>
                                            <span>Faithfulness: {m.faithfulness}</span>
                                        </div>
                                    )}
                                </div>
                                
                                {m.role === 'user' && (
                                    <div className="w-8 h-8 rounded-full bg-gray-200 border border-gray-400 flex items-center justify-center ml-3 mt-1 shrink-0 shadow-lg">
                                        <User size={16} className="text-black" />
                                    </div>
                                )}
                            </div>
                        ))}

                        {isLoading && (
                            <div className="flex justify-start animate-in fade-in duration-300">
                                <div className="w-8 h-8 rounded-full bg-cyan-950 border border-cyan-400 flex items-center justify-center mr-3 shrink-0 shadow-[0_0_8px_rgba(6,182,212,0.3)]">
                                    <Bot size={16} className="text-cyan-400" />
                                </div>
                                <div className="bg-gray-950 py-4 px-6 border-l-4 border-cyan-400 border-y border-r border-gray-800 flex items-center space-x-2"
                                     style={{ borderTopLeftRadius: '1.25rem', borderTopRightRadius: '1.25rem', borderBottomRightRadius: '1.25rem', borderBottomLeftRadius: '0.25rem' }}>
                                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce shadow-[0_0_5px_rgba(0,229,255,0.8)]" />
                                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce shadow-[0_0_5px_rgba(0,229,255,0.8)]" style={{ animationDelay: "0.15s" }} />
                                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce shadow-[0_0_5px_rgba(0,229,255,0.8)]" style={{ animationDelay: "0.3s" }} />
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} className="h-4" />
                    </div>
                </div>

                {/* Input Area Dock */}
                <div className="border-t border-gray-800 bg-gray-950 p-4 shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-10 w-full relative">
                    <div className="max-w-4xl mx-auto flex gap-3 relative">
                        <textarea
                            className="bg-black border border-gray-700 text-white rounded-lg pl-4 pr-12 py-3.5 flex-1 focus:border-cyan-400 focus:shadow-[0_0_10px_rgba(0,229,255,0.15)] outline-none resize-none transition-all"
                            placeholder="Interrogate the clinical AI assistant..."
                            rows={1}
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            style={{ minHeight: '52px', maxHeight: '160px' }}
                        />
                        <button
                            onClick={() => sendMessage(inputText)}
                            disabled={isLoading || isTyping || !inputText.trim()}
                            className="bg-cyan-400 text-black px-6 py-3 rounded-lg font-bold hover:bg-cyan-300 disabled:bg-gray-800 disabled:border-gray-800 disabled:text-gray-600 transition flex items-center justify-center disabled:cursor-not-allowed shadow-[0_0_10px_rgba(0,229,255,0.2)] disabled:shadow-none"
                        >
                            {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} className={inputText.trim() ? "translate-x-0.5" : ""} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Right Panel: Context Configurations */}
            <div className="w-80 bg-gray-950 p-6 flex flex-col gap-6 h-[calc(100vh-68px)] overflow-y-auto hidden lg:flex shrink-0">
                <div>
                    <div className="text-gray-500 text-[10px] tracking-widest font-bold mb-3 uppercase flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${patientMode ? 'bg-amber-400' : 'bg-cyan-400'}`} />
                        Engine Mode Toggle
                    </div>
                    <div className="flex bg-black border border-gray-800 rounded p-1 shadow-inner">
                        <button
                            onClick={() => setPatientMode(false)}
                            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all duration-300 ${!patientMode ? 'bg-cyan-400 text-black shadow-md' : 'text-gray-500 hover:text-white'}`}
                        >
                            General
                        </button>
                        <button
                            onClick={() => setPatientMode(true)}
                            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all duration-300 ${patientMode ? 'bg-cyan-400 text-black shadow-md' : 'text-gray-500 hover:text-white'}`}
                        >
                            Patient
                        </button>
                    </div>
                </div>

                {patientMode ? (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="text-gray-500 text-[10px] tracking-widest font-bold mb-3 uppercase">Linked Patient Identity</div>
                        <select
                            className="w-full bg-black border border-gray-800 text-cyan-400 p-3 rounded outline-none text-sm focus:border-cyan-400 transition cursor-pointer hover:border-gray-600"
                            value={selectedCase}
                            onChange={handlePatientSelect}
                        >
                            <option value="">-- Target Case ID --</option>
                            {cases.map(c => (
                                <option key={c.case_id} value={c.case_id}>Case #{c.case_id}</option>
                            ))}
                        </select>

                        {patientStats && (
                            <div className="mt-6 space-y-3 animate-in fade-in duration-500">
                                <div className="text-gray-500 text-[10px] tracking-widest font-bold uppercase">Dynamic Context Telemetry</div>
                                
                                <div className="bg-black border border-gray-800 px-4 py-3 rounded flex justify-between items-center shadow-sm">
                                    <span className="text-gray-400 text-xs tracking-widest">MAP AVG</span>
                                    <span className="text-cyan-400 font-bold">{patientStats.MAP}</span>
                                </div>
                                <div className="bg-black border border-gray-800 px-4 py-3 rounded flex justify-between items-center shadow-sm">
                                    <span className="text-gray-400 text-xs tracking-widest">HR AVG</span>
                                    <span className="text-white font-bold">{patientStats.HR}</span>
                                </div>
                                <div className="bg-black border border-gray-800 px-4 py-3 rounded flex justify-between items-center shadow-sm">
                                    <span className="text-gray-400 text-xs tracking-widest">SpO2 AVG</span>
                                    <span className="text-green-400 font-bold">{patientStats.SpO2}</span>
                                </div>
                                <div className="bg-black border border-red-900/40 px-4 py-3 rounded flex justify-between items-center shadow-sm">
                                    <span className="text-gray-400 text-xs tracking-widest">IOH RATE</span>
                                    <span className="text-red-400 font-bold">{patientStats.IOHRate}%</span>
                                </div>
                                
                                <div className="text-[10px] text-gray-500 mt-3 italic leading-relaxed px-2 border-l-2 border-gray-800">
                                    Telemetry is automatically pre-pended to system prompts for patient-specific clinical queries.
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-gray-500 text-[11px] leading-relaxed italic animate-in fade-in slide-in-from-top-2 border border-gray-800 bg-black/50 p-4 rounded text-center">
                        Running in untethered logical general mode across the core VitalWatch framework.
                    </div>
                )}

                {/* Info Block */}
                <div className="mt-auto bg-black border border-gray-800 rounded p-5 shadow-lg relative overflow-hidden group hover:border-gray-700 transition">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-cyan-400/5 rounded-bl-full pointer-events-none" />
                    <div className="flex items-center text-cyan-400 font-bold uppercase tracking-widest text-[10px] mb-3">
                        <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full mr-2 shadow-[0_0_5px_rgba(0,229,255,1)]" />
                        System Diagnostics
                    </div>
                    <div className="text-gray-500 text-[11px] leading-relaxed relative z-10">
                        RAG pipeline grounded strictly in documented anesthesia guidelines. Powered by GPT-4o-mini alongside a FAISS dense vector search index.
                    </div>
                </div>
            </div>
        </div>
    );
}
