import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { runConnectivityTest, getRecentLogs, ApiLog, updateDailyLimit, getDailyUsage, runDeepSystemCheck, SystemHealthReport } from '../services/geminiService';
import { Key, ExternalLink, ShieldCheck, X, Trash2, Loader2, AlertTriangle, CheckCircle, Activity, Zap, CreditCard, PieChart, Info, Cloud, Server, Database, User, RefreshCw } from 'lucide-react';

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
    const [healthReport, setHealthReport] = useState<SystemHealthReport | null>(null);
    const [isRunningDeepCheck, setIsRunningDeepCheck] = useState(false);
    const [dailyLimit, setDailyLimit] = useState(50);
    const [dailyUsage, setDailyUsage] = useState(0);

    useEffect(() => { if (isOpen) setInputKey(userApiKey || ""); }, [userApiKey, isOpen]);

    const verifyAndSave = async () => {
        if (inputKey.length < 10) return;
        setStatus('VERIFYING');
        try {
            await updateApiKey(inputKey);
            await runConnectivityTest();
            setStatus('VALID');
            setTimeout(() => { if (!forced) onClose(); }, 1000);
        } catch (e: any) {
            setStatus('INVALID');
            setErrorMsg(e.message || "Connection failed.");
        }
    };

    const handleRemove = async () => {
        if (confirm("Remove key?")) {
            await updateApiKey("");
            setInputKey("");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 animate-in fade-in duration-300">
            <div className="w-full max-w-lg bg-[#0e0e0e] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-purple-500 to-yellow-500" />
                <button onClick={onClose} className="absolute top-5 right-5 text-gray-500 hover:text-white"><X size={20} /></button>
                <div className="px-8 pt-10 border-b border-white/5">
                    <h2 className="text-xl font-bold text-white tracking-tight">System Configuration</h2>
                    <div className="flex gap-6 mt-4">
                        {(['SETTINGS', 'HEALTH', 'LIMITS'] as const).map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)} className={`pb-3 text-xs font-bold uppercase border-b-2 transition-colors ${activeTab === tab ? 'border-white text-white' : 'border-transparent text-gray-500'}`}>{tab}</button>
                        ))}
                    </div>
                </div>
                <div className="p-8 overflow-y-auto">
                    {activeTab === 'SETTINGS' && (
                        <div className="space-y-6">
                            <div className="bg-[#0a0a0a] p-4 rounded-xl flex justify-between">
                                <div className="flex gap-3">
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 text-white">{useCredits() ? <CreditCard /> : <Zap />}</div>
                                    <div>
                                        <div className="text-sm font-bold text-white">{useCredits() ? "Credits Mode" : "Personal Key"}</div>
                                        <div className="text-xs text-gray-500">{useCredits() ? `${credits} left` : "Unlimited usage"}</div>
                                    </div>
                                </div>
                            </div>
                            <input type="password" value={inputKey} onChange={e => setInputKey(e.target.value)} className="w-full bg-[#050505] border border-white/10 p-3 rounded-lg text-white" placeholder="Gemini API Key" />
                            <button onClick={verifyAndSave} className="w-full py-3 bg-blue-600 rounded-lg font-bold text-xs">Verify & Save</button>
                            {inputKey && <button onClick={handleRemove} className="w-full text-red-400 text-[10px] font-bold">Remove Key</button>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ApiKeyModal;