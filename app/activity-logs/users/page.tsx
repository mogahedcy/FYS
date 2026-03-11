'use client';

import { useState, useEffect } from 'react';
import { Users, ShieldAlert, FileText, ShieldCheck, Zap, Loader2, Clock, Activity, Download } from 'lucide-react';
import { handleExportSecurityPDF, handleGeneratePDF } from '../utils/pdfGenerator';
import LogDetails from '../components/LogDetails';

export default function UsersTrackingPage() {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [tables, setTables] = useState<string[]>([]);
    const [selectedTable, setSelectedTable] = useState<string | null>(null);
    const [appUsers, setAppUsers] = useState<any[]>([]);
    const [selectedUserLog, setSelectedUserLog] = useState<any | null>(null);
    const [userSpecificLogs, setUserSpecificLogs] = useState<any[]>([]);
    const [isActionLoading, setIsActionLoading] = useState(false);

    // Security States
    const [securityLogs, setSecurityLogs] = useState<any[]>([]);
    const [securityAlerts, setSecurityAlerts] = useState<any[]>([]);
    const [patchedFiles, setPatchedFiles] = useState<any[]>([]);
    const [targetFilePath, setTargetFilePath] = useState('');
    const [patchStatus, setPatchStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error', message: string }>({ type: 'idle', message: '' });

    useEffect(() => {
        const sid = localStorage.getItem('dbConnectionSession');
        setSessionId(sid);
        if (sid) {
            fetchTables(sid);
            fetchSecurityAlerts(sid);
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
            }
        } catch (err) {
            console.error('Failed to fetch tables');
        }
    };

    const fetchAppUsers = async (sid: string, table: string) => {
        setIsActionLoading(true);
        setAppUsers([]);
        try {
            const res = await fetch('/api/db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_app_users', sessionId: sid, targetTable: table }),
            });
            const data = await res.json();
            if (data.success) setAppUsers(data.users || []);
        } catch (err) {
            console.error('Failed to fetch users');
        } finally {
            setIsActionLoading(false);
        }
    };

    const fetchSecurityAlerts = async (sid: string) => {
        try {
            const res = await fetch('/api/db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_security_alerts', sessionId: sid }),
            });
            const data = await res.json();
            if (data.success) {
                setSecurityAlerts(data.alerts || []);
                setSecurityLogs(data.logs || []);
            }
            const resPatched = await fetch('/api/db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_patched_files', sessionId: sid }),
            });
            const dataPatched = await resPatched.json();
            if (dataPatched.success) setPatchedFiles(dataPatched.patches || []);
        } catch (err) {
            console.error('Failed to fetch security alerts/patches');
        }
    };

    const handlePatchFile = async () => {
        if (!targetFilePath) return;
        setPatchStatus({ type: 'loading', message: 'جاري تحليل الملف وحقن كود الحماية...' });
        try {
            const res = await fetch('/api/db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'patch_login_file', sessionId, filePath: targetFilePath }),
            });
            const data = await res.json();
            if (data.success) {
                setPatchStatus({ type: 'success', message: data.message });
                fetchSecurityAlerts(sessionId as string);
            } else {
                setPatchStatus({ type: 'error', message: data.message });
            }
        } catch (err) {
            setPatchStatus({ type: 'error', message: 'فشل الاتصال بالخادم.' });
        }
    };

    const fetchUserSpecificLogs = async (sid: string, table: string, recordId: string) => {
        setIsActionLoading(true);
        setUserSpecificLogs([]);
        try {
            const res = await fetch('/api/db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_user_record_logs', sessionId: sid, targetTable: table, recordId }),
            });
            const data = await res.json();
            if (data.success) setUserSpecificLogs(data.logs || []);
        } catch (err) {
            console.error('Failed to fetch user logs');
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleViewUserLog = (user: any) => {
        setSelectedUserLog(user);
        const recordId = user.id || Object.values(user)[0];
        if (sessionId && selectedTable) {
            fetchUserSpecificLogs(sessionId, selectedTable, String(recordId));
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-in fade-in duration-500">
            {/* Table Selector Sidebar */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 flex flex-col h-[60vh]">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-400" /> جداول المستخدمين
                </h2>
                <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                    {tables.map(table => (
                        <button
                            key={table}
                            onClick={() => { setSelectedTable(table); fetchAppUsers(sessionId as string, table); }}
                            className={`w-full text-right px-4 py-3 rounded-xl border transition-all ${selectedTable === table ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.1)]' : 'bg-slate-800/50 border-transparent hover:bg-slate-700 hover:border-slate-600 text-slate-300'}`}
                        >
                            <span className="font-mono text-sm">{table}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="lg:col-span-3 flex flex-col gap-6">
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5 text-red-500" /> مركز الرصد الأمني (Security Hub)
                        </h2>
                        <div className="flex gap-2">
                            <button onClick={() => handleExportSecurityPDF('preview', securityLogs, securityAlerts)} className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg text-white font-bold transition-colors flex items-center gap-2">
                                <FileText className="w-3.5 h-3.5" /> معاينة
                            </button>
                            <button onClick={() => handleExportSecurityPDF('download', securityLogs, securityAlerts)} className="text-xs bg-red-600 hover:bg-red-500 px-3 py-1.5 rounded-lg text-white font-bold transition-colors flex items-center gap-2">
                                <Download className="w-3.5 h-3.5" /> تصدير تقرير أمني
                            </button>
                            <button onClick={() => fetchSecurityAlerts(sessionId as string)} className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg border border-slate-600 transition-colors">تحديث</button>
                        </div>
                    </div>

                    {securityAlerts.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            {securityAlerts.map((alert, i) => (
                                <div key={i} className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl flex items-center gap-4 animate-pulse">
                                    <ShieldAlert className="w-6 h-6 text-red-500" />
                                    <div>
                                        <h4 className="font-bold text-red-400 text-sm">محاولة اختراق محتملة (Brute Force)</h4>
                                        <p className="text-xs text-slate-400 mt-1">المستخدم <span className="text-white font-mono">{alert.target_user}</span> تعرض لـ <span className="text-red-500 font-bold">{alert.attempts}</span> محاولات فاشلة.</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl flex items-center gap-3 mb-6">
                            <ShieldCheck className="w-5 h-5 text-emerald-400" />
                            <span className="text-xs text-emerald-400 font-medium">لا توجد تهديدات أمنية نشطة حالياً.</span>
                        </div>
                    )}

                    <div className="mb-6 p-5 bg-slate-900/80 rounded-2xl border border-indigo-500/30 shadow-[0_0_30px_rgba(99,102,241,0.1)]">
                        <h3 className="text-sm font-bold text-indigo-300 mb-1 flex items-center gap-2">
                            <Zap className="w-4 h-4 text-yellow-400" /> الربط الذكي لصفحات الدخول (Falcon Eye)
                        </h3>
                        <div className="flex gap-2 mt-4">
                            <input
                                type="text"
                                value={targetFilePath}
                                onChange={(e) => setTargetFilePath(e.target.value)}
                                placeholder="أدخل مسار الملف الكامل هنا..."
                                className="flex-1 bg-black/40 border border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500 font-mono"
                                dir="ltr"
                            />
                            <button onClick={handlePatchFile} disabled={patchStatus.type === 'loading' || !targetFilePath} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap">
                                {patchStatus.type === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} بدء الربط
                            </button>
                        </div>
                        {patchStatus.type !== 'idle' && <div className={`mt-2 text-[11px] p-2 rounded-lg border ${patchStatus.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : patchStatus.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'}`}>{patchStatus.message}</div>}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-right">
                            <thead className="bg-slate-900/50 text-slate-400">
                                <tr>
                                    <th className="px-4 py-3">الوقت</th>
                                    <th className="px-4 py-3">المستخدم</th>
                                    <th className="px-4 py-3">الحدث</th>
                                    <th className="px-4 py-3">الحالة</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {securityLogs.slice(0, 10).map((log, i) => (
                                    <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                                        <td className="px-4 py-2 text-slate-500">{new Date(log.attempt_time).toLocaleTimeString()}</td>
                                        <td className="px-4 py-2 text-slate-300 font-mono">{log.target_user}</td>
                                        <td className="px-4 py-2 text-slate-400">{log.event_type}</td>
                                        <td className="px-4 py-2">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${log.event_type === 'LOGIN_SUCCESS' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                                {log.event_type}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl flex flex-col h-[50vh] overflow-hidden">
                    <div className="p-6 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/80">
                        <h2 className="text-lg font-bold text-white">بيانات المستخدمين الحية</h2>
                        {selectedTable && (
                            <button onClick={() => fetchAppUsers(sessionId as string, selectedTable)} className="text-sm bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 px-4 py-2 rounded-lg border border-indigo-500/30">
                                تحديث
                            </button>
                        )}
                    </div>
                    <div className="flex-1 overflow-auto custom-scrollbar">
                        {!selectedTable ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-500"><Users className="w-16 h-16 mb-4 opacity-30" /><p>اختر جدولاً...</p></div>
                        ) : (
                            <table className="w-full text-sm text-right">
                                <thead className="text-xs text-slate-400 bg-slate-800/90 sticky top-0">
                                    <tr>
                                        <th className="px-5 py-4 text-center">إجراءات</th>
                                        {appUsers.length > 0 && Object.keys(appUsers[0]).map(key => <th key={key} className="px-5 py-4">{key}</th>)}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {appUsers.map((user, idx) => (
                                        <tr key={idx} className="hover:bg-slate-700/30 transition-colors">
                                            <td className="px-5 py-3 text-center"><button onClick={() => handleViewUserLog(user)} className="text-xs bg-indigo-500/20 text-indigo-300 px-3 py-1.5 rounded border border-indigo-500/30">السجل</button></td>
                                            {Object.values(user).map((v, i) => <td key={i} className="px-5 py-3 whitespace-nowrap">{v === null ? 'null' : String(v)}</td>)}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {/* User Log Modal */}
            {selectedUserLog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" dir="rtl">
                    <div className="bg-[#0B1120] border border-slate-700 w-full max-w-4xl max-h-[90vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-slate-800 flex justify-between items-start bg-slate-900/50">
                            <h3 className="text-2xl font-bold text-white flex items-center gap-2"><Activity className="w-6 h-6 text-indigo-400" /> السجل المهني والنشاط</h3>
                            <div className="flex gap-2">
                                <button onClick={() => handleGeneratePDF('preview', 'detailed', userSpecificLogs, localStorage.getItem('dbTargetName'), null, selectedUserLog, '', '', selectedTable ? [selectedTable] : [])} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-bold flex items-center gap-2">
                                    <FileText className="w-4 h-4" /> معاينة
                                </button>
                                <button onClick={() => handleGeneratePDF('download', 'detailed', userSpecificLogs, localStorage.getItem('dbTargetName'), null, selectedUserLog, '', '', selectedTable ? [selectedTable] : [])} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold flex items-center gap-2">
                                    <Download className="w-4 h-4" /> تحميل
                                </button>
                                <button onClick={() => setSelectedUserLog(null)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm border border-slate-700">إغلاق</button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-6 custom-scrollbar">
                            <div className="mb-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {Object.entries(selectedUserLog).map(([k, v]: [string, any]) => (
                                    <div key={k} className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/30"><p className="text-xs text-slate-500 mb-1">{k}</p><p className="text-sm font-mono text-slate-200 truncate">{String(v)}</p></div>
                                ))}
                            </div>
                            <div className="space-y-4">
                                {userSpecificLogs.map((log) => (
                                    <div key={log.id} className="relative pl-4 pr-10 py-4 bg-slate-800/30 border border-slate-700/50 rounded-xl">
                                        <div className={`absolute right-4 top-5 w-3 h-3 rounded-full ${log.action_type === 'INSERT' ? 'bg-emerald-500' : log.action_type === 'UPDATE' ? 'bg-indigo-500' : 'bg-red-500'}`}></div>
                                        <div className="flex justify-between items-center mb-2"><span className="text-xs font-bold bg-slate-700 px-2 py-0.5 rounded">{log.action_type}</span><span className="text-xs text-slate-500 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {new Date(log.action_timestamp).toLocaleString('ar-EG')}</span></div>
                                        <LogDetails details={log.details} />
                                    </div>
                                ))}
                                {userSpecificLogs.length === 0 && <p className="text-center py-10 text-slate-500">لا توجد نشاطات مسجلة.</p>}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
