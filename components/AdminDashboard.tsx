

import React, { useEffect, useState, useRef } from 'react';
import { AdminStats, Feedback } from '../types';
import { adminService } from '../services/adminService';
import { supabase } from '../services/supabaseClient';
import { ArrowLeft, RefreshCw, Server, MessageSquare, ChevronDown, Award, X, Zap, WifiOff, AlertTriangle, Activity } from 'lucide-react';

interface AdminDashboardProps {
    onClose: () => void;
}

const FunctioningGraph = ({ data }: { data: { date: string, count: number }[] }) => {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);

    useEffect(() => {
        if (containerRef.current) {
            const resizeObserver = new ResizeObserver(entries => {
                if (entries[0]) setWidth(entries[0].contentRect.width);
            });
            resizeObserver.observe(containerRef.current);
            return () => resizeObserver.disconnect();
        }
    }, []);

    if (!data.length || width === 0) return <div ref={containerRef} className="w-full h-full" />;

    const height = 240;
    const paddingLeft = 40;
    const paddingBottom = 30;
    const paddingTop = 20;
    const paddingRight = 20;

    const graphWidth = width - paddingLeft - paddingRight;
    const graphHeight = height - paddingTop - paddingBottom;

    const maxVal = Math.max(...data.map(d => d.count), 10);
    const yMax = Math.ceil(maxVal / 5) * 5;

    const getX = (i: number) => paddingLeft + (i / (data.length - 1)) * graphWidth;
    const getY = (val: number) => paddingTop + graphHeight - (val / yMax) * graphHeight;

    const points = data.map((d, i) => `${getX(i)},${getY(d.count)}`).join(' ');
    const areaPath = `${points} L ${paddingLeft + graphWidth},${paddingTop + graphHeight} L ${paddingLeft},${paddingTop + graphHeight} Z`;

    return (
        <div ref={containerRef} className="w-full h-full relative font-mono text-[10px] select-none">
            <svg width={width} height={height} className="overflow-visible">
                <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                    </linearGradient>
                </defs>
                {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
                    const yVal = Math.round(yMax * tick);
                    const yPos = getY(yVal);
                    return (
                        <g key={tick}>
                            <line x1={paddingLeft} y1={yPos} x2={width - paddingRight} y2={yPos} stroke="#333" strokeWidth="1" strokeDasharray="4 4" />
                            <text x={paddingLeft - 8} y={yPos + 3} textAnchor="end" fill="#666">{yVal}</text>
                        </g>
                    );
                })}
                {data.map((d, i) => {
                    if (i % Math.ceil(data.length / 6) === 0 || i === data.length - 1) {
                        return <text key={i} x={getX(i)} y={height - 10} textAnchor="middle" fill="#666">{d.date}</text>
                    }
                    return null;
                })}
                <path d={areaPath} fill="url(#areaGradient)" />
                <polyline points={points} fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
                {data.map((d, i) => (
                    <circle 
                        key={i} cx={getX(i)} cy={getY(d.count)} r={hoveredIndex === i ? 5 : 3} 
                        fill={hoveredIndex === i ? "#fff" : "#60a5fa"}
                        stroke={hoveredIndex === i ? "#3b82f6" : "none"}
                        strokeWidth={2}
                        className="transition-all duration-200"
                    />
                ))}
                {data.map((_, i) => (
                    <rect 
                        key={i} x={getX(i) - (graphWidth / (data.length - 1)) / 2} y={paddingTop} width={graphWidth / (data.length - 1)} height={graphHeight}
                        fill="transparent" onMouseEnter={() => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)} className="cursor-crosshair"
                    />
                ))}
            </svg>
            {hoveredIndex !== null && (
                <div 
                    className="absolute bg-[#1a1a1a] border border-white/20 px-3 py-2 rounded-lg shadow-xl pointer-events-none z-50 flex flex-col items-center"
                    style={{ left: getX(hoveredIndex) - 40, top: getY(data[hoveredIndex].count) - 50 }}
                >
                    <span className="text-white font-bold">{data[hoveredIndex].count} reqs</span>
                    <span className="text-gray-400 text-[9px]">{data[hoveredIndex].date}</span>
                    <div className="absolute bottom-[-5px] left-1/2 -translate-x-1/2 w-2 h-2 bg-[#1a1a1a] border-r border-b border-white/20 rotate-45" />
                </div>
            )}
        </div>
    );
};

const CompactStatCard = ({ title, value, sub, accentColor }: any) => (
    <div className="bg-[#111] border border-white/10 rounded-lg p-4 flex flex-col justify-between h-24 hover:border-white/20 transition-colors">
        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest truncate">{title}</div>
        <div className="flex items-baseline gap-2 mt-1">
            <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
        </div>
        <div className={`text-[10px] font-mono ${accentColor} truncate`}>{sub}</div>
    </div>
);

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onClose }) => {
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [feedback, setFeedback] = useState<Feedback[]>([]);
    const [view, setView] = useState<'DASHBOARD' | 'HEALTH'>('DASHBOARD');
    
    // Connection States
    const [connectionStatus, setConnectionStatus] = useState<'CONNECTING' | 'CONNECTED' | 'ERROR' | 'TIMEOUT'>('CONNECTING');
    const [isLoading, setIsLoading] = useState(true);
    const [timeRange, setTimeRange] = useState(14);
    
    // Notifications
    const [milestoneToast, setMilestoneToast] = useState<string | null>(null);
    const [liveEventToast, setLiveEventToast] = useState<string | null>(null);

    // Diagnostics
    const [diagnosticLogs, setDiagnosticLogs] = useState<string[]>([]);
    const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);

    const refreshData = async () => {
        setIsLoading(true);
        setConnectionStatus('CONNECTING');
        try {
            const [s, f] = await Promise.all([
                adminService.getStats(timeRange),
                adminService.getFeedback()
            ]);
            setStats(s);
            setFeedback(f);
            setConnectionStatus('CONNECTED');
        } catch (e: any) {
            console.error(e);
            if (e.message === 'Request timed out') {
                setConnectionStatus('TIMEOUT');
            } else {
                setConnectionStatus('ERROR');
            }
            // Auto-switch to Health view on error to guide user
            setView('HEALTH');
        } finally {
            setIsLoading(false);
        }
    };

    const runDiagnostics = async () => {
        setIsRunningDiagnostics(true);
        setDiagnosticLogs(["Running..."]);
        try {
            const logs = await adminService.runDatabaseDiagnostics();
            setDiagnosticLogs(logs);
        } catch (e) {
            setDiagnosticLogs(prev => [...prev, "Critical Failure in Diagnostics runner"]);
        } finally {
            setIsRunningDiagnostics(false);
        }
    }

    useEffect(() => {
        refreshData();
    }, [timeRange]);

    useEffect(() => {
        const channel = supabase.channel('admin-dashboard-live')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'usage_logs' }, (payload) => {
                setStats(prev => {
                    if (!prev) return null;
                    const next = JSON.parse(JSON.stringify(prev));
                    next.totalRequests += 1;
                    next.activeNow += 1;
                    next.creditsConsumed += 5;
                    const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    const todayEntry = next.requestsOverTime.find((r: any) => r.date === todayStr);
                    if (todayEntry) todayEntry.count += 1;
                    return next;
                });
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feedback' }, (payload) => {
                adminService.getFeedback().then(setFeedback);
                setLiveEventToast(`New Feedback received!`);
                setTimeout(() => setLiveEventToast(null), 4000);
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('Admin Realtime Subscribed');
                } else if (status === 'CHANNEL_ERROR') {
                    console.warn('Realtime Error. Check Supabase replication settings.');
                }
            });

        return () => { supabase.removeChannel(channel); };
    }, []);

    useEffect(() => {
        if (stats) {
            const milestones = [100, 500, 1000, 5000, 10000];
            const lastCelebrated = parseInt(localStorage.getItem('bubble_milestone_celebrated') || '0');
            const current = stats.totalRequests;
            
            const crossed = milestones.filter(m => current >= m && m > lastCelebrated).pop();
            
            if (crossed) {
                setMilestoneToast(`🚀 Amazing! We just hit ${crossed.toLocaleString()} total requests!`);
                localStorage.setItem('bubble_milestone_celebrated', crossed.toString());
            }
        }
    }, [stats]);

    return (
        <div className="fixed inset-0 z-50 bg-[#050505] text-white flex flex-col font-sans">
            
            {milestoneToast && (
                <div className="fixed top-20 right-6 z-[60] animate-in fade-in slide-in-from-right-10 duration-500">
                    <div className="bg-[#1a1a1a] border border-yellow-500/30 rounded-xl p-4 shadow-2xl flex items-start gap-3 max-w-sm backdrop-blur-xl">
                        <div className="bg-yellow-500/10 p-2 rounded-lg text-yellow-400"><Award size={24} /></div>
                        <div className="flex-1">
                            <h4 className="text-white font-bold text-sm mb-1">Target Hit!</h4>
                            <p className="text-xs text-gray-400 leading-relaxed">{milestoneToast}</p>
                        </div>
                        <button onClick={() => setMilestoneToast(null)} className="text-gray-500 hover:text-white"><X size={16} /></button>
                    </div>
                </div>
            )}

             {liveEventToast && (
                <div className="fixed bottom-6 right-6 z-[60] animate-in fade-in slide-in-from-bottom-5 duration-500">
                    <div className="bg-[#1a1a1a] border border-blue-500/30 rounded-xl p-3 shadow-2xl flex items-center gap-3 backdrop-blur-xl">
                         <div className="bg-blue-500/10 p-1.5 rounded-lg text-blue-400"><MessageSquare size={16} /></div>
                        <span className="text-xs font-bold text-white">{liveEventToast}</span>
                    </div>
                </div>
            )}

            <div className="h-14 border-b border-white/10 bg-[#0a0a0a] flex items-center justify-between px-6 flex-shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="hover:text-gray-300 transition-colors"><ArrowLeft size={18} /></button>
                    <div className="h-4 w-px bg-white/10" />
                    <div className="flex items-center gap-2">
                        <Server size={16} className={connectionStatus === 'ERROR' || connectionStatus === 'TIMEOUT' ? 'text-red-500' : 'text-blue-500'} />
                        <span className="font-bold text-sm tracking-tight">Admin Console</span>
                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ml-2 border ${connectionStatus === 'CONNECTED' ? 'bg-green-500/10 border-green-500/20' : connectionStatus === 'CONNECTING' ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                             <div className={`w-1.5 h-1.5 rounded-full ${connectionStatus === 'CONNECTED' ? 'bg-green-500 animate-pulse' : connectionStatus === 'CONNECTING' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`} />
                             <span className={`text-[9px] font-bold uppercase ${connectionStatus === 'CONNECTED' ? 'text-green-500' : connectionStatus === 'CONNECTING' ? 'text-yellow-500' : 'text-red-500'}`}>{connectionStatus === 'CONNECTED' ? 'Live' : connectionStatus}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                     <div className="flex bg-[#111] p-0.5 rounded-lg border border-white/10">
                        <button onClick={() => setView('DASHBOARD')} className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-colors ${view === 'DASHBOARD' ? 'bg-white/10 text-white' : 'text-gray-500'}`}>Dashboard</button>
                        <button onClick={() => setView('HEALTH')} className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-colors ${view === 'HEALTH' ? 'bg-white/10 text-white' : 'text-gray-500'}`}>System Health</button>
                     </div>
                    <span className="text-[10px] text-gray-500 font-mono hidden sm:inline border-l border-white/10 pl-4">{stats ? `DATA SYNCED: ${new Date().toLocaleTimeString()}` : "NO DATA"}</span>
                    <button onClick={refreshData} disabled={isLoading} className="p-1.5 hover:bg-white/10 rounded-md text-gray-400 hover:text-white transition-colors"><RefreshCw size={14} className={isLoading ? "animate-spin" : ""} /></button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                
                {view === 'HEALTH' ? (
                    <div className="max-w-4xl mx-auto space-y-6">
                         <div className="bg-[#111] border border-white/10 rounded-xl p-6">
                             <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2"><Activity size={20} className="text-green-400" /> Database Diagnostics</h3>
                                    <p className="text-gray-500 text-xs mt-1">Run an explicit write test to check if Supabase RLS policies are correct.</p>
                                </div>
                                <button 
                                    onClick={runDiagnostics}
                                    disabled={isRunningDiagnostics}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {isRunningDiagnostics ? 'Running...' : 'Run Write Test'}
                                </button>
                             </div>

                             <div className="bg-black rounded-lg border border-white/10 p-4 font-mono text-xs h-64 overflow-y-auto">
                                 {diagnosticLogs.length === 0 ? (
                                     <div className="text-gray-600 italic">No diagnostics run. Click the button to start.</div>
                                 ) : (
                                     <div className="space-y-1">
                                         {diagnosticLogs.map((log, i) => (
                                             <div key={i} className={`${log.includes('FAILED') || log.includes('CRITICAL') || log.includes('EXCEPTION') ? 'text-red-400' : log.includes('SUCCESS') ? 'text-green-400' : 'text-gray-300'}`}>
                                                 <span className="opacity-50 mr-2">{new Date().toLocaleTimeString()}</span>
                                                 {log}
                                             </div>
                                         ))}
                                     </div>
                                 )}
                             </div>
                         </div>
                    </div>
                ) : (
                    <>
                    {(connectionStatus === 'ERROR' || connectionStatus === 'TIMEOUT') && (
                        <div className="max-w-4xl mx-auto mb-6 bg-red-900/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-4">
                            <WifiOff className="text-red-500 mt-1" size={20} />
                            <div>
                                <h3 className="text-white font-bold text-sm">Connection Failed</h3>
                                <p className="text-xs text-red-300 mt-1 leading-relaxed">
                                    {connectionStatus === 'TIMEOUT' ? "Request timed out. Check if RLS policies are blocking access or if the table is locked." : "Access denied. Ensure you are logged in as admin and RLS policies are correct."}
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="max-w-6xl mx-auto space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <CompactStatCard title="Active Users" value={stats?.totalUsers || 0} sub="In selected period" accentColor="text-blue-400" />
                            <CompactStatCard title="Total Requests" value={stats?.totalRequests.toLocaleString() || 0} sub="Lifetime API Calls" accentColor="text-green-400" />
                            <CompactStatCard title="Credits Used" value={stats?.creditsConsumed.toLocaleString() || 0} sub="Estimated Token Usage" accentColor="text-yellow-400" />
                            <CompactStatCard title="Feedback Items" value={feedback.length} sub={`${feedback.filter(f => f.status === 'NEW').length} Pending Review`} accentColor="text-purple-400" />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-auto lg:h-[320px]">
                            <div className="lg:col-span-3 bg-[#111] border border-white/10 rounded-xl p-5 flex flex-col relative group hover:border-white/20 transition-colors min-h-[300px]">
                                <div className="flex items-center justify-between mb-4">
                                    <div><h3 className="text-xs font-bold text-white uppercase tracking-wider">Request Traffic</h3><p className="text-[10px] text-gray-500 font-mono mt-0.5">API Calls per day</p></div>
                                    <div className="flex bg-[#050505] rounded-md border border-white/10 p-0.5">
                                        {[7, 14, 30].map(days => (
                                            <button key={days} onClick={() => setTimeRange(days)} className={`px-3 py-1 text-[10px] font-bold rounded-sm transition-colors ${timeRange === days ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>{days}D</button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex-1 w-full min-h-0">
                                    {stats ? <FunctioningGraph data={stats.requestsOverTime} /> : <div className="w-full h-full flex items-center justify-center text-gray-700 text-xs">Loading Data...</div>}
                                </div>
                            </div>

                            <div className="bg-[#111] border border-white/10 rounded-xl p-5 flex flex-col min-h-[300px]">
                                <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-6">Mode Distribution</h3>
                                <div className="flex-1 flex flex-col justify-center space-y-6">
                                    {stats?.modeDistribution.map((item) => {
                                        const total = stats.modeDistribution.reduce((acc, curr) => acc + curr.count, 0) || 1;
                                        const percent = Math.round((item.count / total) * 100);
                                        const color = item.mode === 'SOLVER' ? 'bg-blue-500' : item.mode === 'EXAM' ? 'bg-purple-500' : 'bg-yellow-500';
                                        const textCol = item.mode === 'SOLVER' ? 'text-blue-400' : item.mode === 'EXAM' ? 'text-purple-400' : 'text-yellow-400';
                                        return (
                                            <div key={item.mode} className="space-y-1.5">
                                                <div className="flex justify-between items-end text-[10px] font-bold uppercase tracking-wide"><span className="text-gray-400">{item.mode}</span><span className={textCol}>{percent}%</span></div>
                                                <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden"><div className={`h-full rounded-full ${color} transition-all duration-1000 ease-out`} style={{ width: `${percent}%` }} /></div>
                                            </div>
                                        )
                                    })}
                                    {(!stats || stats.modeDistribution.reduce((a, b) => a + b.count, 0) === 0) && <div className="text-center text-[10px] text-gray-600 italic">No usage data yet.</div>}
                                </div>
                            </div>
                        </div>

                        <div className="bg-[#111] border border-white/10 rounded-xl overflow-hidden flex flex-col">
                            <div className="px-5 py-3 border-b border-white/5 bg-[#161616] flex items-center gap-2">
                                <MessageSquare size={14} className="text-gray-400" />
                                <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider">Recent Feedback</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs text-gray-400">
                                    <thead className="bg-[#0f0f0f] text-gray-500 font-bold uppercase tracking-wider border-b border-white/5">
                                        <tr><th className="px-5 py-3 w-24">Type</th><th className="px-5 py-3">User</th><th className="px-5 py-3">Message</th><th className="px-5 py-3 w-32 text-right">Date</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {feedback.length === 0 ? (<tr><td colSpan={4} className="px-6 py-8 text-center text-gray-600 italic">No feedback entries found.</td></tr>) : (
                                            feedback.slice(0, 5).map((item) => (
                                                <tr key={item.id} className="hover:bg-white/5 transition-colors">
                                                    <td className="px-5 py-3"><span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${item.type === 'BUG' ? 'bg-red-500/10 text-red-400 border-red-500/20' : item.type === 'FEATURE' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : item.type === 'HELP' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>{item.type}</span></td>
                                                    <td className="px-5 py-3 font-medium text-gray-300">{item.userName}</td>
                                                    <td className="px-5 py-3 truncate max-w-md text-gray-400" title={item.message}>{item.message}</td>
                                                    <td className="px-5 py-3 text-right font-mono text-[10px] text-gray-500">{new Date(item.timestamp).toLocaleDateString()}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default AdminDashboard;