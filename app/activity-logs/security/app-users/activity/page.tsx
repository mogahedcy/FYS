'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, RefreshCw, Loader2, Download, Eye, Search, Filter, CheckCircle2, XCircle, AlertTriangle, Clock, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { handleExportAppUsersPDF } from '../../../utils/pdfGenerator';

type Log = { id: number; target_user: string; event_type: string; ip_address: string; attempt_time: string; details: string };
type UserStat = { target_user: string; total: number; failed: number; success: number };

const EVENT_COLORS: Record<string, string> = {
    LOGIN_SUCCESS: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    LOGIN_FAILED: 'text-red-400 bg-red-500/10 border-red-500/30',
    LOGOUT: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
    BRUTE_FORCE_ALERT: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
};
const EVENT_AR: Record<string, string> = {
    LOGIN_SUCCESS: 'دخول ناجح', LOGIN_FAILED: 'فشل دخول',
    LOGOUT: 'خروج', BRUTE_FORCE_ALERT: 'هجوم متكرر',
};

export default function AppUserActivityPage() {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [dbName, setDbName] = useState<string | null>(null);
    const [tableName] = useState(() => typeof window !== 'undefined' ? localStorage.getItem('appUsersTable') || '' : '');
    const [logs, setLogs] = useState<Log[]>([]);
    const [stats, setStats] = useState<UserStat[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [filterUser, setFilterUser] = useState('');
    const [filterEvent, setFilterEvent] = useState('ALL');
    const [selectedUser, setSelectedUser] = useState<string | null>(null);
    const [error, setError] = useState('');
    const LIMIT = 30;

    useEffect(() => {
        const sid = localStorage.getItem('dbConnectionSession');
        const db = localStorage.getItem('dbTargetName');
        setSessionId(sid);
        setDbName(db);
        if (sid) fetchActivity(sid, 1, '', 'ALL');
    }, []);

    const fetchActivity = useCallback(async (sid: string, pg: number, user: string, evt: string) => {
        setLoading(true); setError('');
        try {
            const res = await fetch('/api/db', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_app_user_activity', sessionId: sid, targetUser: user || undefined, eventType: evt, page: pg, limit: LIMIT }),
            });
            const data = await res.json();
            if (data.success) { setLogs(data.logs || []); setTotal(data.total || 0); setStats(data.stats || []); setPage(pg); }
            else setError(data.message || 'فشل جلب البيانات');
        } catch { setError('تعذر الاتصال — تأكد من تفعيل نظام المراقبة'); }
        finally { setLoading(false); }
    }, []);

    const reload = () => sessionId && fetchActivity(sessionId, 1, filterUser, filterEvent);

    const handleUserClick = (user: string) => {
        const u = selectedUser === user ? '' : user;
        setSelectedUser(u || null);
        setFilterUser(u);
        if (sessionId) fetchActivity(sessionId, 1, u, filterEvent);
    };

    const handleExport = (mode: 'preview' | 'download', type: 'quick' | 'detailed') => {
        handleExportAppUsersPDF(mode, type, logs, [], dbName, filterUser || null, tableName);
    };

    const totalPages = Math.ceil(total / LIMIT);

    return (
        <div className="flex flex-col gap-5">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-purple-400" />
                    سجل نشاط مستخدمي التطبيق
                    <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{total} حدث</span>
                </h3>
                <div className="flex gap-2 flex-wrap">
                    <button onClick={() => handleExport('preview', 'quick')}
                        className="flex items-center gap-1.5 px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 rounded-xl text-xs font-bold transition-all">
                        <Eye className="w-3.5 h-3.5" /> معاينة سريعة
                    </button>
                    <button onClick={() => handleExport('download', 'detailed')}
                        className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all">
                        <Download className="w-3.5 h-3.5" /> تحميل مفصّل
                    </button>
                    <button onClick={reload} className="p-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 hover:text-white transition-all">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
                    <span className="text-xs opacity-70 mr-2">— تأكد من تفعيل نظام المراقبة وترقيع تطبيقك</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
                {/* Users Stats Sidebar */}
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 flex flex-col gap-2">
                    <p className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" /> المستخدمون النشطون
                    </p>
                    {stats.length === 0 && !loading && (
                        <p className="text-xs text-slate-600 text-center py-4">لا بيانات</p>
                    )}
                    {stats.map((s, i) => (
                        <button key={i} onClick={() => handleUserClick(s.target_user)}
                            className={`p-3 rounded-xl border text-right transition-all ${selectedUser === s.target_user ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-900/60 border-slate-700/50 text-slate-300 hover:border-purple-500/30'}`}>
                            <div className="flex items-center justify-between mb-1">
                                <span className="font-bold text-xs font-mono truncate max-w-[100px]">{s.target_user}</span>
                                <span className="text-[10px] opacity-60">{s.total} حدث</span>
                            </div>
                            <div className="flex gap-2">
                                <span className="text-[10px] text-emerald-400">✓{s.success}</span>
                                <span className="text-[10px] text-red-400">✗{s.failed}</span>
                            </div>
                        </button>
                    ))}
                    {selectedUser && (
                        <button onClick={() => { setSelectedUser(null); setFilterUser(''); if (sessionId) fetchActivity(sessionId, 1, '', filterEvent); }}
                            className="text-xs text-purple-400 hover:text-purple-300 mt-1 text-center">
                            ✕ إلغاء الفلتر
                        </button>
                    )}
                </div>

                {/* Main Table */}
                <div className="lg:col-span-3 flex flex-col gap-4">
                    {/* Filters */}
                    <div className="flex gap-2 flex-wrap">
                        <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-700 rounded-xl px-3 py-2">
                            <Search className="w-3.5 h-3.5 text-slate-500" />
                            <input type="text" placeholder="بحث بالمستخدم..." value={filterUser}
                                onChange={e => { setFilterUser(e.target.value); if (sessionId) fetchActivity(sessionId, 1, e.target.value, filterEvent); }}
                                className="bg-transparent text-sm text-slate-300 placeholder:text-slate-600 outline-none w-32" />
                        </div>
                        <div className="flex gap-1">
                            {['ALL', 'LOGIN_SUCCESS', 'LOGIN_FAILED', 'BRUTE_FORCE_ALERT'].map(t => (
                                <button key={t} onClick={() => { setFilterEvent(t); if (sessionId) fetchActivity(sessionId, 1, filterUser, t); }}
                                    className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-all ${filterEvent === t
                                        ? t === 'LOGIN_FAILED' ? 'bg-red-600 border-red-500 text-white'
                                            : t === 'LOGIN_SUCCESS' ? 'bg-emerald-600 border-emerald-500 text-white'
                                                : t === 'BRUTE_FORCE_ALERT' ? 'bg-orange-600 border-orange-500 text-white'
                                                    : 'bg-slate-600 border-slate-500 text-white'
                                        : 'bg-slate-800/60 border-slate-700 text-slate-500 hover:border-slate-600'}`}>
                                    {t === 'ALL' ? 'الكل' : EVENT_AR[t]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden">
                        {loading ? (
                            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-purple-400" /></div>
                        ) : logs.length === 0 ? (
                            <div className="text-center py-16 text-slate-500">
                                <Activity className="w-12 h-12 mx-auto mb-3 opacity-10" />
                                <p className="text-sm">لا توجد أحداث — استخدم الترقيع الذكي لبدء التسجيل</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-right">
                                    <thead className="bg-slate-800/80 text-xs text-slate-400 border-b border-slate-700">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold">نوع الحدث</th>
                                            <th className="px-4 py-3 font-semibold">المستخدم</th>
                                            <th className="px-4 py-3 font-semibold">IP</th>
                                            <th className="px-4 py-3 font-semibold">التوقيت</th>
                                            <th className="px-4 py-3 font-semibold">تفاصيل</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60">
                                        {logs.map(log => (
                                            <tr key={log.id} className="hover:bg-slate-800/50 transition-colors cursor-pointer"
                                                onClick={() => handleUserClick(log.target_user)}>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold border ${EVENT_COLORS[log.event_type] || 'text-slate-400 bg-slate-500/10 border-slate-500/30'}`}>
                                                        {log.event_type === 'LOGIN_SUCCESS' ? <CheckCircle2 className="w-3 h-3" /> : log.event_type === 'LOGIN_FAILED' ? <XCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                                                        {EVENT_AR[log.event_type] || log.event_type}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 font-mono text-xs text-purple-300 font-bold">{log.target_user || '—'}</td>
                                                <td className="px-4 py-3 font-mono text-xs text-slate-400">{log.ip_address || '—'}</td>
                                                <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                                                    <div className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3 opacity-50" />
                                                        {new Date(log.attempt_time).toLocaleString('ar-EG')}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-slate-500 max-w-[180px] truncate">{log.details || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">{(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} من {total}</span>
                            <div className="flex items-center gap-2">
                                <button onClick={() => sessionId && fetchActivity(sessionId, page - 1, filterUser, filterEvent)} disabled={page === 1}
                                    className="p-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 hover:text-white transition-all disabled:opacity-30">
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                                <span className="text-xs text-slate-400 font-mono bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg">{page}/{totalPages}</span>
                                <button onClick={() => sessionId && fetchActivity(sessionId, page + 1, filterUser, filterEvent)} disabled={page >= totalPages}
                                    className="p-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 hover:text-white transition-all disabled:opacity-30">
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
