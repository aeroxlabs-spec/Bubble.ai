
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { runConnectivityTest, getRecentLogs, ApiLog, updateDailyLimit, getDailyUsage, runDeepSystemCheck, SystemHealthReport } from '../services/geminiService';
import { Key, ExternalLink, ShieldCheck, X, Trash2, Loader2, AlertTriangle, CheckCircle, Activity, Zap, CreditCard, PieChart, Info, Cloud, Server, Database, Globe, Lock, User, RefreshCw, HardDrive } from 'lucide-react';

interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    forced?: boolean; 
    initialTab?: 'SETTINGS' | 'HEALTH';
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, forced = false, initialTab = 'SETTINGS' }) => {
    const { userApiKey, updateApiKey, credits, useCredits, isCloudSynced, user } = useAuth();
    const [activeTab, setActiveTab] = useState<'SETTINGS' | 'HEALTH' | 'LIMITS'>(initialTab);
    const [inputKey, setInputKey] = useState(userApiKey);
    const [status, setStatus] = useState<'IDLE' | 'VERIFYING' | 'VALID' | 'INVALID'>('IDLE');
    const [errorMsg, setErrorMsg] = useState('');
    
    // Diagnostics State
    const [logs, setLogs] = useState<ApiLog[]>([]);
    const [healthReport, setHealthReport] = useState<SystemHealthReport | null>(null);
    const [isRunningDeepCheck, setIsRunningDeepCheck] = useState(false);

    // Limits State
    const [dailyLimit, setDailyLimit] = useState(50);
    const [dailyUsage, setDailyUsage] = useState(0);

    useEffect(() => {
        // Sync local input with global state only when opening or if global state changes externally
        if (isOpen) {
             setInputKey(userApiKey || "");
        }
    }, [userApiKey, isOpen]);

    useEffect(() => {
        if (isOpen) {
            setInputKey(userApiKey || "");
            setStatus('IDLE');
            setErrorMsg('');
            setLogs(getRecentLogs());
            const usage = getDailyUsage();
            setDailyLimit(usage.limit);
            setDailyUsage(usage.count);
            setActiveTab(initialTab);
        }
    }, [isOpen, initialTab]);

    useEffect(() => {
        if (isOpen && activeTab === 'HEALTH') {
             handleRunDeepCheck();
        }
    }, [isOpen, activeTab]);

    const handleUpdateLimit = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && val > 0) {
            setDailyLimit(val);
            updateDailyLimit(val);
        }
    };

    if (!isOpen) return null;

    const verifyAndSave = async () => {
        const cleanedKey = inputKey.trim();
        if (cleanedKey.length < 10) {
            setErrorMsg("Key looks too short.");
            return;
        }

        setStatus('VERIFYING');
        setErrorMsg('');

        try {
            // 1. Update Context & Save to DB
            // If this throws, it means DB save failed (network/auth issue)
            await updateApiKey(cleanedKey); 

            // 2. Test Connectivity
            // If this throws, the key is invalid or API is down
            await runConnectivityTest();

            setStatus('VALID');
            setTimeout(() => {
                if (!forced) onClose();
            }, 1000);

        } catch (e: any) {
            console.error("Key verification failed", e);
            setStatus('INVALID');
            setErrorMsg(e.message || "Connection failed. Please check key.");
        }
    };

    const handleRunDeepCheck = async () => {
        setIsRunningDeepCheck(true);
        setHealthReport(null);
        try {
            const report = await runDeepSystemCheck();
            setHealthReport(report);
        } catch (e) {
            console.error(e);
        } finally {
            setIsRunningDeepCheck(false);
        }
    };

    const handleRemove = async () => {
        if (confirm("Remove key? You will revert to using credits (if available).")) {
            // Explicitly clear input and status immediately
            setInputKey("");
            setStatus('IDLE');
            setErrorMsg("");
            
            try {
                // Update global state
                await updateApiKey("");
            } catch (e: any) {
                setErrorMsg(`Failed to remove key: ${e.message}`);
            }
        }
    };

    const StatusBadge = ({ status }: { status: 'PASS' | 'FAIL' | 'WARN' }) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
            status === 'PASS' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
            status === 'FAIL' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
            'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
        }`}>
            {status}
        </span>
    );

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 animate-in fade-in duration-300">
            <div className="w-full max-w-lg bg-[#0e0e0e] border border-white/10 rounded-3xl shadow-2xl overflow-hidden relative flex flex-col max-h-[90vh]">
                
                {/* Gradient Top Line */}
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-purple-500 to-yellow-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]" />

                {!forced && (
                    <button onClick={onClose} className="absolute top-5 right-5 text-gray-500 hover:text-white transition-colors z-20">
                        <X size={20} />
                    </button>
                )}

                {/* Header & Tabs */}
                <div className="bg-[#0e0e0e] px-8 pt-10 pb-0 border-b border-white/5">
                    <h2 className="text-xl font-bold text-white tracking-tight mb-2">System Configuration</h2>
                    {forced && <p className="text-red-400 text-xs mb-4">You have run out of free credits. Please add a key.</p>}
                    <div className="flex items-center gap-6 mt-4">
                        <button 
                            onClick={() => setActiveTab('SETTINGS')}
                            className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
                                activeTab === 'SETTINGS' 
                                ? 'border-white text-white' 
                                : 'border-transparent text-gray-500 hover:text-gray-300'
                            }`}
                        >
                            Credentials
                        </button>
                        <button 
                            onClick={() => setActiveTab('HEALTH')}
                            className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
                                activeTab === 'HEALTH' 
                                ? 'border-white text-white' 
                                : 'border-transparent text-gray-500 hover:text-gray-300'
                            }`}
                        >
                            Status
                        </button>
                        <button 
                            onClick={() => setActiveTab('LIMITS')}
                            className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
                                activeTab === 'LIMITS' 
                                ? 'border-white text-white' 
                                : 'border-transparent text-gray-500 hover:text-gray-300'
                            }`}
                        >
                            Limits
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {activeTab === 'SETTINGS' ? (
                        <div className="p-8 space-y-8">
                            
                            {/* Credits Status */}
                            <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${useCredits() ? 'bg-yellow-500/10 text-yellow-500' : 'bg-green-500/10 text-green-500'}`}>
                                        {useCredits() ? <CreditCard size={18} /> : <Zap size={18} />}
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-white">
                                            {useCredits() ? "Free Credits Mode" : "Personal Key Active"}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {useCredits() 
                                                ? `${credits} credits remaining.` 
                                                : "Unlimited usage enabled."
                                            }
                                        </div>
                                    </div>
                                </div>
                                {useCredits() && credits <= 10 && (
                                    <span className="text-[10px] font-bold text-red-400 bg-red-900/20 px-2 py-1 rounded">Low Balance</span>
                                )}
                            </div>

                            {/* Key Input Section */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                        <Key size={14} /> Gemini API Key
                                    </label>
                                    <div className="flex items-center gap-3">
                                         <a 
                                            href="https://aistudio.google.com/app/apikey" 
                                            target="_blank" 
                                            rel="noreferrer" 
                                            className="text-[10px] font-bold uppercase tracking-wide text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                                        >
                                            Get Key <ExternalLink size={10} />
                                        </a>
                                        {inputKey && !forced && (
                                            <button 
                                                type="button" 
                                                onClick={handleRemove} 
                                                className="text-red-400 hover:text-red-300 text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 transition-colors"
                                            >
                                                <Trash2 size={10} /> Revoke
                                            </button>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="relative group">
                                    <input 
                                        type="password" 
                                        value={inputKey}
                                        onChange={(e) => { setInputKey(e.target.value); setStatus('IDLE'); }}
                                        placeholder="AIzaSy..."
                                        className="relative w-full bg-[#050505] border border-white/10 rounded-lg px-4 py-3.5 text-sm text-white font-mono focus:outline-none focus:border-white/20 transition-colors placeholder:text-gray-700"
                                    />
                                    
                                    <div className="absolute right-3 top-3.5 z-10">
                                        {status === 'VERIFYING' && <Loader2 size={16} className="text-white animate-spin" />}
                                        {status === 'VALID' && <CheckCircle size={16} className="text-green-500" />}
                                        {status === 'INVALID' && <AlertTriangle size={16} className="text-red-500" />}
                                    </div>
                                </div>

                                {errorMsg && (
                                    <div className="bg-red-900/10 border border-red-500/20 rounded-lg p-3 animate-in fade-in slide-in-from-top-2">
                                        <div className="flex items-center gap-2 mb-1">
                                            <AlertTriangle size={12} className="text-red-500" />
                                            <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Validation Error</span>
                                        </div>
                                        <p className="text-red-400 text-xs font-mono break-words leading-relaxed">{errorMsg}</p>
                                    </div>
                                )}
                                
                                {isCloudSynced && status === 'IDLE' && inputKey && (
                                     <div className="flex items-center gap-2 text-green-400 text-[10px] font-bold uppercase tracking-wide px-1">
                                         <Cloud size={12} /> Synced to Account
                                     </div>
                                )}
                            </div>

                            {/* Secure Notice */}
                            <div className="flex items-center gap-3 px-1 opacity-50 hover:opacity-100 transition-opacity">
                                <ShieldCheck className="text-gray-500 flex-shrink-0" size={14} />
                                <p className="text-[10px] text-gray-500 leading-tight">
                                    BYOK Architecture: Your key is stored securely in your private database table and locally in your browser.
                                </p>
                            </div>

                            {/* Verify Button */}
                            <button 
                                onClick={verifyAndSave}
                                disabled={status === 'VERIFYING' || inputKey.length < 5}
                                className={`w-full py-3.5 rounded-lg font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all duration-300 border ${
                                    status === 'VALID'
                                    ? 'border-green-500/50 text-green-400 bg-green-500/10' 
                                    : 'border-white/20 text-white bg-transparent hover:border-white/50 hover:bg-white/5'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                {status === 'VERIFYING' ? "Validating..." : status === 'VALID' ? "Verified" : "Verify & Save Key"}
                            </button>
                        </div>
                    ) : activeTab === 'LIMITS' ? (
                        <div className="p-8 space-y-6">
                            <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4">
                                <div className="flex items-center gap-3 mb-4">
                                    <PieChart size={18} className="text-purple-400" />
                                    <div>
                                        <h3 className="text-sm font-bold text-white">Daily Usage Protection</h3>
                                        <p className="text-xs text-gray-500">Set soft limits to prevent unexpected costs.</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs font-medium">
                                            <span className="text-gray-400">Requests Today</span>
                                            <span className="text-white">{dailyUsage} / {dailyLimit}</span>
                                        </div>
                                        <div className="h-2 bg-[#151515] rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-500 ${
                                                    (dailyUsage / dailyLimit) > 0.9 ? 'bg-red-500' : 'bg-purple-500'
                                                }`} 
                                                style={{ width: `${Math.min(100, (dailyUsage / dailyLimit) * 100)}%` }} 
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2 pt-2">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                            Soft Limit (Requests/Day)
                                        </label>
                                        <input 
                                            type="number"
                                            value={dailyLimit}
                                            onChange={handleUpdateLimit}
                                            className="w-full bg-[#050505] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50 transition-colors"
                                        />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex items-start gap-3 bg-blue-900/10 border border-blue-500/20 p-4 rounded-xl">
                                <Info size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
                                <div className="space-y-2">
                                    <p className="text-xs text-blue-200 leading-relaxed">
                                        These limits are tracked locally in your browser. For hard limits and budget alerts, use the Google Cloud Console.
                                    </p>
                                    <a 
                                        href="https://console.cloud.google.com/apis/dashboard" 
                                        target="_blank" 
                                        rel="noreferrer" 
                                        className="text-[10px] font-bold uppercase tracking-wider text-blue-400 hover:text-white flex items-center gap-1 transition-colors"
                                    >
                                        Manage Quotas <ExternalLink size={10} />
                                    </a>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-6 space-y-4 h-full flex flex-col">
                            <div className="flex items-center justify-between pb-2">
                                <div>
                                    <h3 className="text-sm font-bold text-white">System Status</h3>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Real-time Diagnostics</p>
                                </div>
                                <button 
                                    onClick={handleRunDeepCheck}
                                    disabled={isRunningDeepCheck}
                                    className="text-[10px] font-bold uppercase tracking-wider border border-white/10 hover:border-blue-500/30 text-white bg-white/5 hover:bg-blue-500/10 px-3 py-2 rounded-lg transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isRunningDeepCheck ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                    Run Scan
                                </button>
                            </div>

                            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                                {healthReport ? (
                                    <>
                                        {/* 1. Account Identity Check */}
                                        <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-3 flex items-center justify-between">
                                             <div className="flex items-center gap-3">
                                                 <User size={16} className="text-blue-400" />
                                                 <div>
                                                     <span className="text-xs font-bold text-gray-300 block">Account</span>
                                                     <span className="text-[10px] text-gray-500 font-mono block">{user?.email || "Guest"}</span>
                                                 </div>
                                             </div>
                                             <StatusBadge status={user ? 'PASS' : 'WARN'} />
                                        </div>

                                        {/* 2. Database Connectivity */}
                                        <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-3 flex items-center justify-between">
                                             <div className="flex items-center gap-3">
                                                 <Database size={16} className="text-purple-400" />
                                                 <div>
                                                     <span className="text-xs font-bold text-gray-300 block">Cloud Services</span>
                                                     <span className="text-[10px] text-gray-500 block">{healthReport.checks.database ? "Connected" : "Disconnected"}</span>
                                                 </div>
                                             </div>
                                             <StatusBadge status={healthReport.checks.database ? 'PASS' : 'FAIL'} />
                                        </div>

                                        {/* 3. API Key Source Analysis */}
                                        <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-3">
                                             <div className="flex items-center justify-between mb-2">
                                                 <div className="flex items-center gap-3">
                                                     <Key size={16} className="text-yellow-400" />
                                                     <div>
                                                         <span className="text-xs font-bold text-gray-300 block">Key Status</span>
                                                         <span className="text-[10px] text-gray-500 block">Active</span>
                                                     </div>
                                                 </div>
                                                 <StatusBadge status={healthReport.keyMode !== 'NONE' ? 'PASS' : 'FAIL'} />
                                             </div>
                                             
                                             {/* Sub-check for Key Sync */}
                                             <div className="ml-7 pl-3 border-l border-white/10 space-y-1">
                                                 <div className="flex justify-between items-center text-[10px] text-gray-400">
                                                     <span>Cloud Sync</span>
                                                     <span className={healthReport.checks.dbKeyFound ? "text-green-400" : "text-gray-600"}>{healthReport.checks.dbKeyFound ? "FOUND" : "MISSING"}</span>
                                                 </div>
                                                 <div className="flex justify-between items-center text-[10px] text-gray-400">
                                                     <span>Local Storage</span>
                                                     <span className={healthReport.checks.localStorage ? "text-green-400" : "text-gray-600"}>{healthReport.checks.localStorage ? "FOUND" : "MISSING"}</span>
                                                 </div>
                                                 {healthReport.checks.keyMismatch && (
                                                     <div className="flex justify-between items-center text-[10px] text-red-400 font-bold mt-1 bg-red-900/10 px-2 py-0.5 rounded">
                                                         <AlertTriangle size={10} /> Sync Mismatch Detected
                                                     </div>
                                                 )}
                                             </div>
                                        </div>

                                        {/* 4. Gemini API Latency */}
                                        <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-3 flex items-center justify-between">
                                             <div className="flex items-center gap-3">
                                                 <Server size={16} className="text-green-400" />
                                                 <div>
                                                     <span className="text-xs font-bold text-gray-300 block">API Latency</span>
                                                     <span className="text-[10px] text-gray-500 block">Round-trip</span>
                                                 </div>
                                             </div>
                                             <div className="text-right">
                                                 <StatusBadge status={healthReport.checks.apiKey ? 'PASS' : 'FAIL'} />
                                                 <div className="text-[10px] font-mono text-white mt-0.5">{healthReport.latencyMs}ms</div>
                                             </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-48 border border-dashed border-white/10 rounded-xl bg-white/5">
                                        <Activity className="text-gray-600 mb-3" size={32} />
                                        <p className="text-gray-500 text-xs italic">System scan waiting to start...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ApiKeyModal;
