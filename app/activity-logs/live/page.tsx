'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
    Activity, Database, Clock, Download, Loader2, Search,
    ChevronLeft, ChevronRight, Filter, Shield, AlertTriangle,
    CheckCircle2, XCircle, FileText, RefreshCw, Radio, Eye
} from 'lucide-react';
import { handleGeneratePDF } from '../utils/pdfGenerator';
import LogDetails from '../components/LogDetails';

const ITEMS_PER_PAGE = 50;

const ACTION_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
    INSERT: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'إضافة' },
    UPDATE: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30', label: 'تعديل' },
    DELETE: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30', label: 'حذف' },
};

const getSeverity = (action: string) => {
    if (action === 'DELETE') return { label: 'عالي', color: 'text-red-400', icon: <AlertTriangle className="w-3 h-3" /> };
    if (action === 'UPDATE') return { label: 'متوسط', color: 'text-yellow-400', icon: <Shield className="w-3 h-3" /> };
    return { label: 'منخفض', color: 'text-emerald-400', icon: <CheckCircle2 className="w-3 h-3" /> };
};

export default function LiveLogsPage() {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [dbName, setDbName] = useState<string | null>(null);
    const [tables, setTables] = useState<string[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const lastLogIdRef = useRef<number>(0);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [isOffline, setIsOffline] = useState(false);
    const [isLive, setIsLive] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    // Filtering states
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [selectedReportTables, setSelectedReportTables] = useState<string[]>([]);
    const [actionFilter, setActionFilter] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        const sid = localStorage.getItem('dbConnectionSession');
        const db = localStorage.getItem('dbTargetName');
        setSessionId(sid);
        setDbName(db);

        if (sid) {
            fetchLogs(sid);
            fetchTables(sid);

            const interval = setInterval(() => {
                if (isLive) fetchNewLogs(sid);
            }, 5000);
            return () => clearInterval(interval);
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

    const fetchLogs = async (sid: string) => {
        setIsActionLoading(true);
        try {
            const res = await fetch('/api/db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'get_logs',
                    sessionId: sid,
                    startDate: startDate || undefined,
                    endDate: endDate || undefined,
                    tableNames: selectedReportTables.length > 0 ? selectedReportTables : undefined
                }),
            });
            const data = await res.json();
            if (data.success) {
                setLogs(data.logs || []);
                setIsOffline(!!data.fromCache);
                setLastUpdated(new Date());
                if (data.logs && data.logs.length > 0 && !data.fromCache) {
                    const maxId = Math.max(...data.logs.map((l: any) => l.id));
                    lastLogIdRef.current = maxId;
                }
                setCurrentPage(1);
            }
        } catch (err) {
            console.error('Failed to fetch logs');
        } finally {
            setIsActionLoading(false);
        }
    };

    const fetchNewLogs = async (sid: string) => {
        if (lastLogIdRef.current === 0) return;
        try {
            const res = await fetch('/api/db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_new_logs', sessionId: sid, lastLogId: lastLogIdRef.current }),
            });
            const data = await res.json();
            if (data.success && data.newLogs && data.newLogs.length > 0) {
                const maxId = Math.max(...data.newLogs.map((l: any) => l.id));
                lastLogIdRef.current = maxId;
                setLogs(prev => [...data.newLogs, ...prev]);
                setLastUpdated(new Date());
                setCurrentPage(1);
            }
        } catch (err) {
            console.error('Failed to fetch new logs', err);
        }
    };

    // Filtering logic
    const filteredLogs = logs.filter(log => {
        const matchesAction = actionFilter === 'ALL' || log.action_type === actionFilter;
        const matchesSearch = searchQuery === '' ||
            log.table_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            String(log.record_id)?.includes(searchQuery);
        const matchesTable = selectedReportTables.length === 0 || selectedReportTables.includes(log.table_name);
        return matchesAction && matchesSearch && matchesTable;
    });

    const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
    const paginatedLogs = filteredLogs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const stats = {
        total: logs.length,
        insert: logs.filter(l => l.action_type === 'INSERT').length,
        update: logs.filter(l => l.action_type === 'UPDATE').length,
        delete: logs.filter(l => l.action_type === 'DELETE').length,
    };

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">

            {/* ── Offline Banner ── */}
            {isOffline && (
                <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex items-center justify-between text-amber-400">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center">
                            <Clock className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="font-bold text-sm">وضع العرض غير المتصل (Offline Mode)</p>
                            <p className="text-xs opacity-80">تعذر الاتصال بقاعدة البيانات. يتم عرض البيانات المحفوظة محلياً.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => fetchLogs(sessionId as string)}
                        className="text-xs bg-amber-500 text-black px-4 py-2 rounded-lg font-bold hover:bg-amber-400 transition-colors"
                    >
                        إعادة محاولة
                    </button>
                </div>
            )}

            {/* ── Live Status Bar ── */}
            <div className="flex items-center justify-between bg-slate-900/60 border border-slate-700/50 rounded-2xl px-5 py-3">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${isLive && !isOffline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
                        <span className={`text-xs font-bold ${isLive && !isOffline ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {isLive && !isOffline ? 'مراقبة مباشرة نشطة' : 'موقوف'}
                        </span>
                    </div>
                    {lastUpdated && (
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            آخر تحديث: {lastUpdated.toLocaleTimeString('ar-EG')}
                        </span>
                    )}
                    {dbName && (
                        <span className="text-xs text-slate-400 flex items-center gap-1 bg-slate-800 px-3 py-1 rounded-full">
                            <Database className="w-3 h-3 text-indigo-400" /> {dbName}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsLive(v => !v)}
                        className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg font-bold border transition-all ${isLive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}
                    >
                        <Radio className="w-3 h-3" />
                        {isLive ? 'إيقاف التحديث التلقائي' : 'تفعيل التحديث التلقائي'}
                    </button>
                    <button
                        onClick={() => sessionId && fetchLogs(sessionId)}
                        disabled={isActionLoading}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-all"
                    >
                        <RefreshCw className={`w-3 h-3 ${isActionLoading ? 'animate-spin' : ''}`} />
                        تحديث
                    </button>
                </div>
            </div>

            {/* ── Stats Cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'إجمالي العمليات', value: stats.total, color: 'text-slate-200', icon: <Activity className="w-5 h-5 text-slate-400" />, bg: 'bg-slate-800/60', border: 'border-slate-700/50', action: 'ALL' },
                    { label: 'عمليات الإضافة', value: stats.insert, color: 'text-emerald-400', icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />, bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', action: 'INSERT' },
                    { label: 'عمليات التعديل', value: stats.update, color: 'text-blue-400', icon: <Eye className="w-5 h-5 text-blue-400" />, bg: 'bg-blue-500/5', border: 'border-blue-500/20', action: 'UPDATE' },
                    { label: 'عمليات الحذف', value: stats.delete, color: 'text-red-400', icon: <XCircle className="w-5 h-5 text-red-400" />, bg: 'bg-red-500/5', border: 'border-red-500/20', action: 'DELETE' },
                ].map((stat) => (
                    <button
                        key={stat.action}
                        onClick={() => { setActionFilter(stat.action); setCurrentPage(1); }}
                        className={`p-4 rounded-xl border ${stat.bg} ${stat.border} flex items-center gap-3 text-right hover:opacity-90 transition-all ${actionFilter === stat.action ? 'ring-2 ring-offset-2 ring-offset-slate-900 ring-slate-600' : ''}`}
                    >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-slate-800/60`}>{stat.icon}</div>
                        <div>
                            <p className="text-xs text-slate-500">{stat.label}</p>
                            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                        </div>
                    </button>
                ))}
            </div>

            {/* ── Activity Heatmap ── */}
            <div className="hidden lg:block bg-slate-800/20 border border-slate-700/30 p-5 rounded-2xl">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs text-slate-400">توزيع النشاط خلال 24 ساعة الماضية</span>
                    </div>
                    <span className="text-xs text-slate-600 font-mono">{new Date().toLocaleDateString('ar-EG')}</span>
                </div>
                <div className="flex justify-between items-end h-20 gap-1">
                    {Array.from({ length: 24 }).map((_, i) => {
                        const hour = (new Date().getHours() - (23 - i) + 24) % 24;
                        const count = logs.filter(l => new Date(l.action_timestamp).getHours() === hour).length;
                        const height = Math.min(100, (count / (logs.length || 1)) * 600 + 4);
                        const hasDeletes = logs.filter(l => new Date(l.action_timestamp).getHours() === hour && l.action_type === 'DELETE').length > 0;
                        return (
                            <div key={i} className="flex-1 flex flex-col items-center group relative">
                                {count > 0 && (
                                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-700 text-white text-[9px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                        {hour}:00 — {count} حدث
                                    </div>
                                )}
                                <div
                                    className={`w-full ${hasDeletes ? 'bg-red-500/50 group-hover:bg-red-400' : 'bg-emerald-500/40 group-hover:bg-emerald-400'} transition-all rounded-t-sm`}
                                    style={{ height: `${height}%` }}
                                />
                                <span className="text-[8px] text-slate-700 mt-1">{hour}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Main Table Card ── */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 flex flex-col min-h-[60vh]">

                {/* Toolbar */}
                <div className="flex flex-col gap-4 mb-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-base font-bold text-white flex items-center gap-2">
                            <Shield className="w-4 h-4 text-indigo-400" />
                            سجل أحداث قاعدة البيانات
                            <span className="text-xs font-normal text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{filteredLogs.length} حدث</span>
                        </h2>
                        {/* PDF Buttons */}
                        <div className="flex items-center gap-2">
                            <button onClick={() => handleGeneratePDF('preview', 'quick', logs, dbName, null, null, startDate, endDate, selectedReportTables)}
                                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition-all font-medium">
                                <FileText className="w-3.5 h-3.5" /> معاينة سريعة
                            </button>
                            <button onClick={() => handleGeneratePDF('preview', 'detailed', logs, dbName, null, null, startDate, endDate, selectedReportTables)}
                                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-white border border-indigo-500/50 transition-all font-medium">
                                <FileText className="w-3.5 h-3.5" /> تقرير مفصل
                            </button>
                            <button onClick={() => handleGeneratePDF('download', 'detailed', logs, dbName, null, null, startDate, endDate, selectedReportTables)}
                                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 text-white border border-emerald-500/50 transition-all font-medium">
                                <Download className="w-3.5 h-3.5" /> تصدير PDF
                            </button>
                        </div>
                    </div>

                    {/* Filter Bar */}
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Search */}
                        <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-700 rounded-xl px-3 py-2 flex-1 min-w-[180px]">
                            <Search className="w-4 h-4 text-slate-500 shrink-0" />
                            <input
                                type="text"
                                placeholder="بحث بالجدول أو رقم السجل..."
                                value={searchQuery}
                                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                                className="bg-transparent text-sm text-slate-300 placeholder:text-slate-600 outline-none w-full text-right"
                            />
                        </div>

                        {/* Date Range */}
                        <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-700 rounded-xl px-3 py-2">
                            <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)}
                                className="bg-transparent text-xs text-slate-300 outline-none" />
                            <span className="text-slate-600">—</span>
                            <input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)}
                                className="bg-transparent text-xs text-slate-300 outline-none" />
                        </div>

                        <button onClick={() => sessionId && fetchLogs(sessionId)}
                            className="text-xs bg-indigo-600/30 text-indigo-400 hover:bg-indigo-600/50 px-4 py-2 rounded-xl transition-colors border border-indigo-500/30 font-bold">
                            تطبيق
                        </button>
                    </div>

                    {/* Table Tags + Action Filter */}
                    <div className="flex flex-wrap items-center gap-2">
                        <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        {/* Action Chips */}
                        {['ALL', 'INSERT', 'UPDATE', 'DELETE'].map(type => (
                            <button key={type}
                                onClick={() => { setActionFilter(type); setCurrentPage(1); }}
                                className={`text-[11px] px-3 py-1 rounded-full border font-bold transition-all ${actionFilter === type
                                    ? type === 'ALL' ? 'bg-slate-600 border-slate-500 text-white'
                                        : type === 'INSERT' ? 'bg-emerald-500 border-emerald-400 text-white'
                                            : type === 'UPDATE' ? 'bg-blue-500 border-blue-400 text-white'
                                                : 'bg-red-500 border-red-400 text-white'
                                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                                {type === 'ALL' ? 'الكل' : type === 'INSERT' ? 'إضافة' : type === 'UPDATE' ? 'تعديل' : 'حذف'}
                            </button>
                        ))}
                        <span className="text-slate-700 mx-1">|</span>
                        {/* Table Chips */}
                        {tables.slice(0, 6).map(t => (
                            <button key={t}
                                onClick={() => {
                                    setSelectedReportTables(prev =>
                                        prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
                                    );
                                    setCurrentPage(1);
                                }}
                                className={`text-[11px] px-3 py-1 rounded-full border transition-all ${selectedReportTables.includes(t)
                                    ? 'bg-indigo-500 border-indigo-400 text-white'
                                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                                {t}
                            </button>
                        ))}
                        {tables.length > 6 && <span className="text-[11px] text-slate-500">+{tables.length - 6} أخرى</span>}
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto border border-slate-700/50 rounded-xl bg-slate-900/30">
                    <table className="w-full text-sm text-right">
                        <thead className="text-xs text-slate-400 bg-slate-800/90 sticky top-0 border-b border-slate-700">
                            <tr>
                                <th className="px-4 py-3.5 font-semibold">#</th>
                                <th className="px-4 py-3.5 font-semibold">الجدول</th>
                                <th className="px-4 py-3.5 font-semibold">نوع الحدث</th>
                                <th className="px-4 py-3.5 font-semibold">مستوى الخطورة</th>
                                <th className="px-4 py-3.5 font-semibold">معرّف السجل</th>
                                <th className="px-4 py-3.5 font-semibold">التوقيت</th>
                                <th className="px-4 py-3.5 font-semibold">تفاصيل التغيير</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {isActionLoading ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-16 text-center">
                                        <div className="flex flex-col items-center gap-3 text-slate-500">
                                            <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
                                            <p className="text-sm">جاري تحميل السجلات...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : paginatedLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-16 text-center">
                                        <div className="flex flex-col items-center gap-3 text-slate-500">
                                            <Activity className="w-10 h-10 opacity-20" />
                                            <p className="text-sm">لا توجد سجلات تطابق معايير البحث.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedLogs.map((log: any) => {
                                    const actionStyle = ACTION_COLORS[log.action_type] || ACTION_COLORS['INSERT'];
                                    const severity = getSeverity(log.action_type);
                                    return (
                                        <tr key={log.id} className="hover:bg-slate-800/50 transition-colors">
                                            <td className="px-4 py-3 font-mono text-[11px] text-slate-600">#{log.id}</td>
                                            <td className="px-4 py-3 font-medium text-slate-300 text-xs">{log.table_name}</td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold font-mono border ${actionStyle.bg} ${actionStyle.text} ${actionStyle.border}`}>
                                                    {log.action_type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1 text-xs font-bold ${severity.color}`}>
                                                    {severity.icon} {severity.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-mono text-xs text-slate-400">{log.record_id}</td>
                                            <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5 justify-end">
                                                    <Clock className="w-3 h-3 opacity-50" />
                                                    {new Date(log.action_timestamp).toLocaleString('ar-EG')}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <LogDetails details={log.details} />
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-700/50">
                        <span className="text-xs text-slate-500">
                            عرض {((currentPage - 1) * ITEMS_PER_PAGE) + 1} – {Math.min(currentPage * ITEMS_PER_PAGE, filteredLogs.length)} من {filteredLogs.length} سجل
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                const page = Math.max(1, Math.min(currentPage - 2, totalPages - 4)) + i;
                                return (
                                    <button key={page} onClick={() => setCurrentPage(page)}
                                        className={`w-8 h-8 text-xs rounded-lg font-bold transition-all ${currentPage === page ? 'bg-indigo-600 text-white' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700'}`}>
                                        {page}
                                    </button>
                                );
                            })}
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
