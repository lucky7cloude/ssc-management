import React, { useState, useEffect } from 'react';
import { Cloud, Share2, RefreshCw, Key, ShieldCheck, Database, Globe, Copy, Check, Link as LinkIcon } from 'lucide-react';
import * as dataService from '../services/dataService';
import { UserRole, SCHOOL_LOGO_URL } from '../types';

interface Props {
    currentRole: UserRole;
}

export const SettingsManager: React.FC<Props> = ({ currentRole }) => {
    const [syncId, setSyncId] = useState(dataService.getSyncId() || '');
    const [isSyncing, setIsSyncing] = useState(false);
    const [copied, setCopied] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);

    useEffect(() => {
        setSyncId(dataService.getSyncId() || '');
    }, []);

    const handleUpdateSyncId = (e: React.FormEvent) => {
        e.preventDefault();
        if(confirm("Changing the Database Key will switch you to a different data stream. If the key is incorrect, you may see empty data. Proceed?")) {
            dataService.setSyncId(syncId);
        }
    };

    const handleManualPull = async () => {
        setIsSyncing(true);
        const result = await dataService.fetchAllData();
        setSyncId(dataService.getSyncId() || ''); // Update ID if it was auto-created
        setIsSyncing(false);
        if (result) {
            window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: "Cloud Sync Complete", type: 'success' } }));
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(syncId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: "Key Copied", type: 'success' } }));
    };

    const copyShareLink = () => {
        const url = `${window.location.origin}/?db=${syncId}`;
        navigator.clipboard.writeText(url);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: "Connection Link Copied", type: 'success' } }));
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                <div className="bg-slate-800 p-10 text-white relative">
                    <div className="absolute top-0 right-0 p-10 opacity-10">
                        <Database className="w-32 h-32" />
                    </div>
                    <div className="flex items-center gap-4 mb-3">
                        <div className="w-12 h-12 bg-brand-500 rounded-2xl flex items-center justify-center shadow-lg">
                            <Cloud className="w-6 h-6 text-white" />
                        </div>
                        <h2 className="text-3xl font-bold font-serif">Cloud Core</h2>
                    </div>
                    <p className="text-slate-400 text-sm font-medium">Your data is stored securely in the cloud. Connect multiple devices to this database to see real-time updates everywhere.</p>
                </div>

                <div className="p-10 space-y-10">
                    {/* Database Identity Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b dark:border-slate-800 pb-3">
                            <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <Key className="w-4 h-4 text-brand-500" /> Active Connection
                            </h4>
                            <span className="text-[9px] font-bold text-green-500 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full uppercase">Online</span>
                        </div>
                        <div className="p-8 bg-slate-50 dark:bg-slate-950 rounded-[2rem] border border-slate-100 dark:border-slate-800 space-y-6">
                            <p className="text-xs text-slate-500 leading-relaxed italic">
                                <strong>Setup Instruction:</strong> Copy the "Connection Link" below and send it to other teachers. When they open the link, their app will automatically connect to this database.
                            </p>
                            
                            <form onSubmit={handleUpdateSyncId} className="space-y-3">
                                <div className="relative group">
                                    <Globe className="w-5 h-5 absolute left-4 top-4 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                                    <input 
                                        type="text" 
                                        value={syncId} 
                                        onChange={(e) => setSyncId(e.target.value)}
                                        className="w-full pl-12 pr-4 h-14 text-xs font-mono bg-white dark:bg-black border border-slate-200 dark:border-slate-800 rounded-2xl shadow-inner text-slate-600 dark:text-slate-300"
                                        placeholder="Database ID..."
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <button type="button" onClick={copyShareLink} className="h-12 bg-brand-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-brand-700 transition-all shadow-md active:scale-95">
                                        {linkCopied ? <Check className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />} Share Link
                                    </button>
                                    <button type="button" onClick={copyToClipboard} className="h-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-50 transition-all shadow-sm active:scale-95">
                                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} Copy Key
                                    </button>
                                </div>
                                <div className="pt-2">
                                    <button type="submit" className="w-full h-10 text-slate-400 hover:text-slate-600 text-[10px] font-bold underline decoration-dotted">
                                        Manually Update Key (Advanced)
                                    </button>
                                </div>
                            </form>
                            
                            <div className="pt-2 border-t dark:border-slate-800">
                                <button onClick={handleManualPull} disabled={isSyncing} className="w-full h-12 bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-black transition-all shadow-lg">
                                    <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} /> Force Cloud Sync
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* School Branding Preview */}
                    <div className="space-y-4">
                        <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest border-b dark:border-slate-800 pb-3 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-brand-500" /> Verified Branding
                        </h4>
                        <div className="p-10 bg-slate-50 dark:bg-slate-950 rounded-[2rem] border border-slate-100 dark:border-slate-800 flex flex-col items-center gap-6 text-center shadow-inner">
                            <div className="w-36 h-36 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-center justify-center overflow-hidden transform hover:scale-105 transition-transform">
                                <img src={SCHOOL_LOGO_URL} alt="School Logo" className="w-full h-full object-contain" />
                            </div>
                            <div>
                                <h5 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-serif">Silver Star Convent School</h5>
                                <p className="text-[10px] text-slate-400 mt-2 uppercase tracking-[0.3em] font-black">Official Cloud Registry</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-100 dark:bg-slate-900 p-5 rounded-2xl text-center border dark:border-slate-800">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">SSC-MANAGEMENT • Made by lucky</p>
                    </div>
                </div>
            </div>
        </div>
    );
};