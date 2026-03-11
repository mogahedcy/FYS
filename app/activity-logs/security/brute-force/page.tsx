'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    ShieldAlert, Clock, RefreshCw, Loader2, CheckCircle2, XCircle,
    AlertTriangle, UserX, ShieldCheck, Info, BadgeAlert, Activity
} from 'lucide-react';

type BruteAlert = { target_user: string; attempts: number; last_attempt: string };
type SecurityLog = { id: number; target_user: string; event_type: string; ip_address: string; attempt_time: string; details: string };

const EVENT_COLORS: Record<string, string> = {
    LOGIN_SUCCESS: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    LOGIN_FAILED: 'text-red-400 bg-red-500/10 border-red-500/30',
    LOGOUT: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
    BRUTE_FORCE_ALERT: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
};
const EVENT_LABELS: Record<string, string> = {
    LOGIN_SUCCESS: 'دخول ناجح', LOGIN_FAILED: 'فشل دخول',
    LOGOUT: 'خروج', BRUTE_FORCE_ALERT: 'هجوم متكرر',
};

export default function BruteForcePage() {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [alerts, setAlerts] = useState<BruteAlert[]>([]);
    const [logs, setLogs] = useState<SecurityLog[]>([]);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [filterType, setFilterType] = useState('ALL');

    useEffect(() => {
        const sid = localStorage.getItem('dbConnectionSession');
        setSessionId(sid);
        if (sid) fetchAlerts(sid);
    }, []);

    const fetchAlerts = useCallback(async (sid: string) => {
        setLoading(true);
        setMessage({ type: '', text: '' });
        try {
            const res = await fetch('/api/db', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_security_alerts', sessionId: sid }),
            });
            const data = await res.json();
            if (data.success) {
                setAlerts(data.alerts || []);
                setLogs(data.logs || []);
            } else {
                setMessage({ type: 'error', text: data.message || 'فشل جلب البيانات' });
            }
        } catch {
            setMessage({ type: 'error', text: 'تعذر الاتصال — تأكد من تفعيل نظام المراقبة أولاً' });
        } finally { setLoading(false); }
    }, []);

    const filteredLogs = filterType === 'ALL' ? logs : logs.filter(l => l.event_type === filterType);

    return (
        <div className="flex flex-col gap-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'تحت الهجوم الآن', value: alerts.length, icon: BadgeAlert, cls: 'text-red-400 bg-red-500/10 border-red-500/30' },
                    { label: 'محاولات فاشلة', value: logs.filter(l => l.event_type === 'LOGIN_FAILED').length, icon: XCircle, cls: 'text-orange-400 bg-orange-500/10 border-orange-500/30' },
                    { label: 'دخول ناجح', value: logs.filter(l => l.event_type === 'LOGIN_SUCCESS').length, icon: CheckCircle2, cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
                    { label: 'إجمالي الأحداث', value: logs.length, icon: Activity, cls: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
                ].map((s, i) => {
                    const Icon = s.icon;
                    return (
                        <div key={i} className={`flex items-center gap-3 p-5 rounded-2xl border ${s.cls}`}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 shrink-0">
                                <Icon className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-2xl font-black">{s.value}</p>
                                <p className="text-[11px] opacity-60 mt-0.5">{s.label}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Message */}
            {message.text && (
                <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-400 flex items-start gap-3 text-sm">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                        <p>{message.text}</p>
                        <p className="text-xs opacity-70 mt-1">تأكد من تفعيل نظام المراقبة وقم بترقيع تطبيقك أولاً.</p>
                    </div>
                </div>
            )}

            {/* Active Brute Alerts */}
            {alerts.length > 0 && (
                <div className="bg-red-900/20 border border-red-500/40 rounded-2xl p-5">
                    <h3 className="font-bold text-red-400 flex items-center gap-2 mb-4 text-sm">
                        <AlertTriangle className="w-4 h-4 animate-pulse" /> هجمات نشطة — آخر 30 دقيقة
                    </h3>
                    <div className="flex flex-col gap-3">
                        {alerts.map((a, i) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-red-950/60 border border-red-500/30 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 bg-red-500/20 rounded-lg flex items-center justify-center">
                                        <UserX className="w-4 h-4 text-red-400" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-white text-sm font-mono">{a.target_user}</p>
                                        <p className="text-xs text-red-400/60 mt-0.5">{new Date(a.last_attempt).toLocaleString('ar-EG')}</p>
                                    </div>
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-3xl font-black text-red-400">{a.attempts}</span>
                                    <span className="text-xs text-red-500">محاولة</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Logs Table */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
                    <h3 className="font-bold text-white flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-slate-400" /> سجل الأحداث
                        <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{filteredLogs.length}</span>
                    </h3>
                    <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                            {['ALL', 'LOGIN_FAILED', 'LOGIN_SUCCESS', 'BRUTE_FORCE_ALERT'].map(type => (
                                <button key={type} onClick={() => setFilterType(type)}
                                    className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all ${filterType === type
                                        ? type === 'LOGIN_FAILED' ? 'bg-red-600 border-red-500 text-white'
                                            : type === 'LOGIN_SUCCESS' ? 'bg-emerald-600 border-emerald-500 text-white'
                                                : type === 'BRUTE_FORCE_ALERT' ? 'bg-orange-600 border-orange-500 text-white'
                                                    : 'bg-slate-600 border-slate-500 text-white'
                                        : 'bg-slate-800/60 border-slate-700 text-slate-500 hover:border-slate-600'}`}>
                                    {type === 'ALL' ? 'الكل' : EVENT_LABELS[type]}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => sessionId && fetchAlerts(sessionId)}
                            className="p-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 hover:text-white transition-all">
                            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-red-400" /></div>
                ) : filteredLogs.length === 0 ? (
                    <div className="text-center py-16 text-slate-500">
                        <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-10" />
                        <p className="text-sm">لا توجد أحداث أمان مسجلة.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-right">
                            <thead className="bg-slate-800/80 text-xs text-slate-400 border-b border-slate-700">
                                <tr>
                                    <th className="px-5 py-3 font-semibold">نوع الحدث</th>
                                    <th className="px-5 py-3 font-semibold">المستخدم</th>
                                    <th className="px-5 py-3 font-semibold">عنوان IP</th>
                                    <th className="px-5 py-3 font-semibold">التوقيت</th>
                                    <th className="px-5 py-3 font-semibold">تفاصيل</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {filteredLogs.map(log => (
                                    <tr key={log.id} className="hover:bg-slate-800/50 transition-colors">
                                        <td className="px-5 py-3">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${EVENT_COLORS[log.event_type] || 'text-slate-400 bg-slate-500/10 border-slate-500/30'}`}>
                                                {EVENT_LABELS[log.event_type] || log.event_type}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 font-mono text-xs text-slate-300">{log.target_user || '—'}</td>
                                        <td className="px-5 py-3 font-mono text-xs text-slate-400">{log.ip_address || '—'}</td>
                                        <td className="px-5 py-3 text-xs text-slate-400 whitespace-nowrap">{new Date(log.attempt_time).toLocaleString('ar-EG')}</td>
                                        <td className="px-5 py-3 text-xs text-slate-500 max-w-[200px] truncate">{log.details || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
