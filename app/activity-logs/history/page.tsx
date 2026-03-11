'use client';

import { useState, useEffect } from 'react';
import {
    Clock, Database, WifiOff, Wifi, FileText, AlertCircle,
    RefreshCw, Download, Search, ChevronLeft, ChevronRight,
    Shield, Timer, Filter
} from 'lucide-react';
import { handleExportConnectionHistoryPDF } from '../utils/pdfGenerator';

const ITEMS_PER_PAGE = 20;

const calcDuration = (start: string, end: string | null) => {
    if (!start) return '—';
    const from = new Date(start).getTime();
    const to = end ? new Date(end).getTime() : Date.now();
    const diffMs = to - from;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins} دقيقة`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} ساعة ${mins % 60} د`;
    return `${Math.floor(hrs / 24)} يوم`;
};

export default function ConnectionHistoryPage() {
    const [history, setHistory] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'active' | 'disconnected'>('ALL');
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_connection_history' }),
            });
            const data = await res.json();
            if (data.success) {
                setHistory(data.history || []);
            }
        } catch (err) {
            console.error('Failed to fetch history');
        } finally {
            setIsLoading(false);
            setCurrentPage(1);
        }
    };

    // Derived
    const filteredHistory = history.filter(item => {
        const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
        const q = searchQuery.toLowerCase();
        const matchesSearch = q === '' ||
            item.database_name?.toLowerCase().includes(q) ||
            item.host?.toLowerCase().includes(q) ||
            item.username?.toLowerCase().includes(q);
        return matchesStatus && matchesSearch;
    });

    const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);
    const paginated = filteredHistory.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const activeCount = history.filter(h => h.status === 'active').length;
    const disconnectedCount = history.filter(h => h.status === 'disconnected').length;

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">

            {/* ── Page Header ── */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Clock className="w-5 h-5 text-indigo-400" />
                        سجل الاتصالات بقواعد البيانات
                    </h2>
                    <p className="text-slate-400 text-xs mt-1">
                        توثيق شامل لجميع جلسات الاتصال — وفق معايير ISO 27001
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => handleExportConnectionHistoryPDF('preview', history)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition-all border border-slate-600"
                    >
                        <FileText className="w-4 h-4" /> معاينة PDF
                    </button>
                    <button
                        onClick={() => handleExportConnectionHistoryPDF('download', history)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all border border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.3)]"
                    >
                        <Download className="w-4 h-4" /> تحميل التقرير
                    </button>
                    <button
                        onClick={fetchHistory}
                        className="p-2 transition-all hover:bg-slate-700 bg-slate-800 border border-slate-700 rounded-xl text-slate-300"
                        title="تحديث البيانات"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* ── Stats Cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                    onClick={() => { setStatusFilter('ALL'); setCurrentPage(1); }}
                    className={`bg-slate-800/50 p-5 rounded-2xl border flex items-center gap-4 hover:opacity-90 transition-all text-right ${statusFilter === 'ALL' ? 'border-indigo-500/50 ring-1 ring-indigo-500/30' : 'border-slate-700/50'}`}
                >
                    <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                        <Database className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500">إجمالي الارتباطات</p>
                        <p className="text-2xl font-bold text-white">{history.length}</p>
                    </div>
                </button>

                <button
                    onClick={() => { setStatusFilter('active'); setCurrentPage(1); }}
                    className={`bg-emerald-500/5 p-5 rounded-2xl border flex items-center gap-4 hover:opacity-90 transition-all text-right ${statusFilter === 'active' ? 'border-emerald-500/50 ring-1 ring-emerald-500/30' : 'border-emerald-500/20'}`}
                >
                    <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center border border-emerald-500/30">
                        <Wifi className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500">اتصالات نشطة حالياً</p>
                        <p className="text-2xl font-bold text-emerald-400">{activeCount}</p>
                    </div>
                </button>

                <button
                    onClick={() => { setStatusFilter('disconnected'); setCurrentPage(1); }}
                    className={`bg-red-500/5 p-5 rounded-2xl border flex items-center gap-4 hover:opacity-90 transition-all text-right ${statusFilter === 'disconnected' ? 'border-red-500/50 ring-1 ring-red-500/30' : 'border-red-500/20'}`}
                >
                    <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center border border-red-500/30">
                        <WifiOff className="w-6 h-6 text-red-400" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500">ارتباطات منتهية</p>
                        <p className="text-2xl font-bold text-red-400">{disconnectedCount}</p>
                    </div>
                </button>
            </div>

            {/* ── Table Card ── */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden">

                {/* Toolbar */}
                <div className="p-5 border-b border-slate-700/50 bg-slate-800/30 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-700 rounded-xl px-3 py-2 flex-1 min-w-[200px]">
                        <Search className="w-4 h-4 text-slate-500 shrink-0" />
                        <input
                            type="text"
                            placeholder="بحث بالاسم، المضيف، المستخدم..."
                            value={searchQuery}
                            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                            className="bg-transparent text-sm text-slate-300 placeholder:text-slate-600 outline-none w-full text-right"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter className="w-3.5 h-3.5 text-slate-500" />
                        {['ALL', 'active', 'disconnected'].map(s => (
                            <button key={s}
                                onClick={() => { setStatusFilter(s as any); setCurrentPage(1); }}
                                className={`text-[11px] px-3 py-1.5 rounded-full border font-bold transition-all ${statusFilter === s
                                    ? s === 'ALL' ? 'bg-slate-600 border-slate-500 text-white'
                                        : s === 'active' ? 'bg-emerald-500 border-emerald-400 text-white'
                                            : 'bg-red-500 border-red-400 text-white'
                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                                {s === 'ALL' ? 'الكل' : s === 'active' ? 'نشط' : 'منتهي'}
                            </button>
                        ))}
                    </div>
                    <span className="text-xs text-slate-500 mr-auto">{filteredHistory.length} نتيجة</span>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-right text-sm">
                        <thead className="text-xs text-slate-500 bg-slate-900/40 border-b border-slate-700/50">
                            <tr>
                                <th className="px-5 py-4 font-semibold">قاعدة البيانات</th>
                                <th className="px-5 py-4 font-semibold">المضيف (Host)</th>
                                <th className="px-5 py-4 font-semibold">المشغّل</th>
                                <th className="px-5 py-4 font-semibold">الحالة</th>
                                <th className="px-5 py-4 font-semibold">مدة الاتصال</th>
                                <th className="px-5 py-4 font-semibold">أول اتصال</th>
                                <th className="px-5 py-4 font-semibold">آخر ظهور</th>
                                <th className="px-5 py-4 font-semibold">وقت الإنهاء</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={8} className="px-5 py-14 text-center text-slate-500">
                                        <div className="flex flex-col items-center gap-3">
                                            <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                                            <p className="text-sm">جاري تحميل السجل...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : paginated.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-5 py-14 text-center">
                                        <div className="flex flex-col items-center gap-3 text-slate-500">
                                            <Database className="w-10 h-10 opacity-20" />
                                            <p className="text-sm">لا توجد سجلات تطابق معايير البحث.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginated.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-700/20 transition-colors">
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                                                    <Database className="w-3.5 h-3.5 text-indigo-400" />
                                                </div>
                                                <span className="font-bold text-white text-xs">{item.database_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 font-mono text-xs text-slate-400">{item.host}</td>
                                        <td className="px-5 py-3.5 text-xs text-slate-300">{item.username}</td>
                                        <td className="px-5 py-3.5">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${item.status === 'active'
                                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                                : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${item.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                                                {item.status === 'active' ? 'نشط' : 'منتهي'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                                                <Timer className="w-3 h-3 text-slate-600" />
                                                {calcDuration(item.first_connected_at, item.disconnected_at)}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-xs text-slate-500">{new Date(item.first_connected_at).toLocaleString('ar-EG')}</td>
                                        <td className="px-5 py-3.5 text-xs text-slate-500">{new Date(item.last_seen_at).toLocaleString('ar-EG')}</td>
                                        <td className="px-5 py-3.5 text-xs text-red-400/70">
                                            {item.disconnected_at ? new Date(item.disconnected_at).toLocaleString('ar-EG') : <span className="text-emerald-400/60">جارٍ الاتصال</span>}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-5 py-4 border-t border-slate-700/50">
                        <span className="text-xs text-slate-500">
                            {((currentPage - 1) * ITEMS_PER_PAGE) + 1} – {Math.min(currentPage * ITEMS_PER_PAGE, filteredHistory.length)} من {filteredHistory.length}
                        </span>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                                className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed">
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
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                                className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed">
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Security Note ── */}
            <div className="bg-indigo-500/5 border border-indigo-500/20 p-5 rounded-2xl flex items-start gap-4">
                <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20 shrink-0">
                    <Shield className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="text-sm">
                    <p className="font-bold text-indigo-300 mb-1">سجل التوثيق — ISO 27001 / SOC 2</p>
                    <p className="text-slate-400 leading-relaxed text-xs">
                        يتم توثيق جميع الاتصالات بقواعد البيانات بشكل آلي وفق سياسة الاحتفاظ بالسجلات. تُحفظ البيانات في قاعدة البيانات الداخلية لنظام المراقبة ويمكن تصديرها كتقرير PDF موقّع في أي وقت.
                    </p>
                </div>
            </div>
        </div>
    );
}
