'use client';

import { useState, useEffect } from 'react';
import { ShieldCheck, Database, Table as TableIcon, Key, X, Loader2, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function TriggersPage() {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [tables, setTables] = useState<string[]>([]);
    const [monitoredTables, setMonitoredTables] = useState<string[]>([]);
    const [selectedTable, setSelectedTable] = useState<string | null>(null);
    const [tableColumns, setTableColumns] = useState<string[]>([]);
    const [selectedPrimaryKey, setSelectedPrimaryKey] = useState<string>('id');
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        const sid = localStorage.getItem('dbConnectionSession');
        setSessionId(sid);
        if (sid) {
            fetchTables(sid);
        }
    }, []);

    const fetchTables = async (sid: string) => {
        try {
            const res = await fetch('/api/db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_tables', sessionId: sid }),
            });
            const data = await res.json();
            if (data.success) {
                setTables(data.tables?.filter((t: string) => t !== '_system_activity_logs') || []);
                setMonitoredTables(data.monitoredTables || []);
            }
        } catch (err) {
            console.error('Failed to fetch tables');
        }
    };

    const handleSelectTable = async (table: string) => {
        setSelectedTable(table);
        setIsActionLoading(true);
        setTableColumns([]);
        try {
            const res = await fetch('/api/db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_table_columns', sessionId, targetTable: table }),
            });
            const data = await res.json();
            if (data.success) {
                setTableColumns(data.columns || []);
                if (data.columns?.includes('id')) {
                    setSelectedPrimaryKey('id');
                } else if (data.columns?.length > 0) {
                    setSelectedPrimaryKey(data.columns[0]);
                }
            } else {
                setMessage({ type: 'error', text: data.message });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'فشل في جلب الأعمدة.' });
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleCreateTriggers = async () => {
        if (!sessionId || !selectedTable || !selectedPrimaryKey) return;
        setIsActionLoading(true);
        setMessage({ type: '', text: '' });
        try {
            const res = await fetch('/api/db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'setup_table_trigger',
                    sessionId,
                    targetTable: selectedTable,
                    primaryKeyColumn: selectedPrimaryKey
                }),
            });
            const data = await res.json();
            if (data.success) {
                setMessage({ type: 'success', text: data.message });
                fetchTables(sessionId);
            } else {
                setMessage({ type: 'error', text: data.message });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'حدث خطأ أثناء التطبيق.' });
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleRemoveTrigger = async (table: string) => {
        if (!sessionId) return;
        setIsActionLoading(true);
        try {
            const res = await fetch('/api/db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'remove_table_trigger', sessionId, targetTable: table }),
            });
            const data = await res.json();
            if (data.success) {
                setMessage({ type: 'success', text: data.message });
                fetchTables(sessionId);
            } else {
                setMessage({ type: 'error', text: data.message });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'فشل في إلغاء المراقبةIndex.' });
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleSetupAllTriggers = async () => {
        if (!sessionId) return;
        setIsActionLoading(true);
        setMessage({ type: '', text: '' });
        try {
            const res = await fetch('/api/db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'setup_all_tables_triggers', sessionId }),
            });
            const data = await res.json();
            if (data.success) {
                setMessage({ type: 'success', text: data.message });
                fetchTables(sessionId);
            } else {
                setMessage({ type: 'error', text: data.message });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'حدث خطأ أثناء التفعيل الشامل.' });
        } finally {
            setIsActionLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            {message.text && (
                <div className={`p-4 rounded-xl flex items-start gap-3 border backdrop-blur-sm ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
                    }`}>
                    {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" /> : <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />}
                    <p className="font-medium text-sm leading-relaxed">{message.text}</p>
                </div>
            )}

            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-emerald-400" />
                            حالة المراقبة لكل الجداول
                        </h2>
                        <p className="text-slate-400 text-sm mt-1">
                            جداول عليها <span className="text-emerald-400 font-bold">{monitoredTables.length}</span> من أصل <span className="text-white font-bold">{tables.length}</span>
                        </p>
                    </div>
                    <button
                        onClick={handleSetupAllTriggers}
                        disabled={isActionLoading}
                        className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold shadow-[0_0_25px_rgba(16,185,129,0.3)] hover:shadow-[0_0_35px_rgba(16,185,129,0.5)] transition-all disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                        {isActionLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري التفعيل...</> : <><ShieldCheck className="w-4 h-4" /> تفعيل المراقبة على كل الجداول‬</>}
                    </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {tables.map(table => {
                        const isMonitored = monitoredTables.includes(table);
                        return (
                            <div
                                key={table}
                                onClick={() => handleSelectTable(table)}
                                className={`relative group cursor-pointer p-3 rounded-xl border transition-all ${selectedTable === table ? 'border-indigo-500 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : isMonitored ? 'border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10' : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'}`}
                            >
                                <div className={`absolute top-2 left-2 w-2 h-2 rounded-full ${isMonitored ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                                <p className="text-sm font-mono text-slate-200 truncate pr-1" title={table}>{table}</p>
                                <p className={`text-xs mt-1 font-semibold ${isMonitored ? 'text-emerald-400' : 'text-slate-500'}`}>
                                    {isMonitored ? '✔ مراقب' : '⦸ غير مراقب'}
                                </p>
                                {isMonitored && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleRemoveTrigger(table); }}
                                        className="absolute bottom-2 left-2 p-1 text-red-400 hover:text-red-300 transition-all opacity-0 group-hover:opacity-100 bg-red-500/10 rounded-md border border-red-500/20"
                                        title="إلغاء المراقبة"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 flex flex-col" style={{ maxHeight: '50vh', minHeight: '200px' }}>
                    <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                        <TableIcon className="w-4 h-4 text-indigo-400" />
                        إعداد جدول بعينه
                    </h2>
                    <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 custom-scrollbar">
                        {tables.map(table => (
                            <button
                                key={table}
                                onClick={() => handleSelectTable(table)}
                                className={`w-full text-right px-3 py-2 rounded-lg border transition-all flex items-center justify-between gap-2 ${selectedTable === table ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' : 'bg-slate-800/50 border-transparent hover:bg-slate-700 hover:border-slate-600 text-slate-300'}`}
                            >
                                <span className="font-mono text-xs truncate">{table}</span>
                                {monitoredTables.includes(table) && <span className="shrink-0 w-2 h-2 rounded-full bg-emerald-400" />}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="lg:col-span-2 bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 flex flex-col relative overflow-hidden">
                    {!selectedTable ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                            <TableIcon className="w-12 h-12 mb-3 opacity-30" />
                            <p>اختر جدولاً من القائمة لإعداد مراقبته بشكل مخصص</p>
                        </div>
                    ) : (
                        <div className="relative z-10 flex-1 flex flex-col">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-xl font-bold text-white">
                                    إعداد جدول: <span className="text-indigo-400 px-2 py-0.5 bg-indigo-500/10 rounded-lg font-mono">{selectedTable}</span>
                                </h2>
                                {monitoredTables.includes(selectedTable) && <span className="text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1 rounded-full font-bold">✔ مراقب حالياً</span>}
                            </div>
                            <p className="text-slate-400 text-sm mb-5">حدد العمود المرجعي (Primary Key) لهذا الجدول.</p>

                            <div className="bg-slate-900/50 border border-slate-700 p-4 rounded-xl mb-5">
                                <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                                    <Key className="w-4 h-4 text-emerald-400" /> المعرف الفريد (Primary Key)
                                </label>
                                {isActionLoading && tableColumns.length === 0 ? (
                                    <div className="flex items-center gap-2 text-slate-400 text-sm p-2"><Loader2 className="w-4 h-4 animate-spin" /> جاري تحميل الأعمدة...</div>
                                ) : (
                                    <select
                                        value={selectedPrimaryKey}
                                        onChange={(e) => setSelectedPrimaryKey(e.target.value)}
                                        className="w-full bg-slate-800 text-slate-200 border border-slate-600 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-sm"
                                    >
                                        {tableColumns.map(col => <option key={col} value={col}>{col}</option>)}
                                    </select>
                                )}
                            </div>

                            <button
                                onClick={handleCreateTriggers}
                                disabled={isActionLoading || tableColumns.length === 0}
                                className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-3 transition-all text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-[0_0_20px_rgba(99,102,241,0.3)] disabled:opacity-50"
                            >
                                {isActionLoading ? <><Loader2 className="w-5 h-5 animate-spin" /> جاري...</> : <><ShieldCheck className="w-5 h-5" /> تفعيل مراقبة هذا الجدول‬</>}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
