'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ShieldAlert, Activity, User, Clock, FileText, Download, CheckCircle2 } from 'lucide-react';
import { handleExportSecurityAlertsPDF } from '../activity-logs/utils/pdfGenerator';

interface SecurityAlert {
    id: number;
    username: string;
    action_type: string;
    details: string;
    ip_address: string;
    created_at: string;
}

export default function SecurityAlertsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [usersList, setUsersList] = useState<string[]>([]);
    const [activityLogs, setActivityLogs] = useState<SecurityAlert[]>([]);
    const [intrusionAlerts, setIntrusionAlerts] = useState<SecurityAlert[]>([]);

    useEffect(() => {
        fetchUsersList();
    }, []);

    useEffect(() => {
        fetchAlerts();
    }, [filter]);

    const fetchUsersList = async () => {
        try {
            const res = await fetch('/api/users');
            const data = await res.json();
            if (data.success && data.users) {
                setUsersList(data.users.map((u: any) => u.username));
            }
        } catch (e) {
            console.error('Failed to fetch users list', e);
        }
    };

    const fetchAlerts = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/security-alerts?username=${filter}`);
            const data = await res.json();
            if (data.success) {
                setActivityLogs(data.activity_logs);
                setIntrusionAlerts(data.intrusion_alerts);
            }
        } catch (error) {
            console.error('Failed to fetch security alerts:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0A0F1C] text-slate-200 p-8 font-sans selection:bg-blue-500/30" dir="rtl">
            <div className="max-w-7xl mx-auto flex flex-col gap-8">
                
                {/* Header */}
                <div className="flex items-center justify-between bg-slate-900/50 backdrop-blur-xl border border-white/5 p-6 rounded-3xl shadow-2xl">
                    <div className="flex items-center gap-5">
                        <button
                            onClick={() => router.push('/')}
                            className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/5 text-slate-400 hover:text-white"
                        >
                            <ArrowRight className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-black text-white flex items-center gap-3">
                                <ShieldAlert className="w-7 h-7 text-red-500" />
                                تنبيهات وحماية النظام الأمني
                            </h1>
                            <p className="text-slate-400 mt-1 text-sm">
                                مراقبة محاولات الاختراق، وتتبع حركة مستخدمي نظام FYS بشكل حيوي ومتكامل
                            </p>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center justify-between bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
                    <div className="flex items-center gap-4">
                        <select 
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-red-500/50 text-sm text-slate-300"
                        >
                            <option value="all">جميع مستخدمي النظام (فلتر شامل)</option>
                            {usersList.map(u => (
                                <option key={u} value={u}>المستخدم: {u}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    
                    {/* Section 1: User Activity Tracking */}
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between bg-blue-900/20 border border-blue-500/20 p-4 rounded-2xl">
                            <h2 className="text-lg font-bold text-blue-400 flex items-center gap-2">
                                <Activity className="w-5 h-5" />
                                تتبع حركة المستخدمين (الدخول / الخروج)
                            </h2>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => handleExportSecurityAlertsPDF('preview', 'تتبع حركة المستخدمين', activityLogs, filter)}
                                    disabled={activityLogs.length === 0}
                                    className="p-2 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 rounded-lg transition-all disabled:opacity-50"
                                    title="معاينة التقرير"
                                >
                                    <FileText className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => handleExportSecurityAlertsPDF('download', 'تتبع حركة المستخدمين', activityLogs, filter)}
                                    disabled={activityLogs.length === 0}
                                    className="p-2 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 rounded-lg transition-all disabled:opacity-50"
                                    title="تحميل PDF"
                                >
                                    <Download className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl h-[600px] overflow-y-auto custom-scrollbar">
                            <table className="w-full text-right text-sm">
                                <thead className="sticky top-0 bg-slate-900/90 backdrop-blur-md z-10">
                                    <tr className="text-slate-400 font-bold border-b border-white/5">
                                        <th className="px-5 py-4">المستخدم</th>
                                        <th className="px-5 py-4">الحدث</th>
                                        <th className="px-5 py-4 text-left">الوقت</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {loading ? (
                                        <tr><td colSpan={3} className="py-20 text-center text-slate-500">جاري التحميل...</td></tr>
                                    ) : activityLogs.length === 0 ? (
                                        <tr><td colSpan={3} className="py-20 text-center text-slate-500">لا توجد سجلات حركة لهذا المستخدم</td></tr>
                                    ) : (
                                        activityLogs.map((log) => (
                                            <tr key={log.id} className="hover:bg-blue-500/[0.02] transition-colors">
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
                                                            <User className="w-4 h-4 text-slate-400" />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-slate-200">{log.username}</p>
                                                            <p className="text-[10px] text-slate-500 font-mono tracking-wider">{log.ip_address}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                                                        <CheckCircle2 className="w-4 h-4" />
                                                        {log.action_type === 'LOGIN_SUCCESS' ? 'تسجيل دخول' : 'تسجيل خروج'}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 text-left">
                                                    <div className="flex items-center justify-end gap-2 text-slate-400">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        <span className="font-mono text-xs">{new Date(log.created_at).toLocaleString('ar-SA')}</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Section 2: Intrusion Alerts & Failed Logins */}
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between bg-red-900/20 border border-red-500/20 p-4 rounded-2xl">
                            <h2 className="text-lg font-bold text-red-400 flex items-center gap-2">
                                <ShieldAlert className="w-5 h-5" />
                                تنبيهات محاولات الاختراق والحظر
                            </h2>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => handleExportSecurityAlertsPDF('preview', 'تنبيهات محاولات الاختراق', intrusionAlerts, filter)}
                                    disabled={intrusionAlerts.length === 0}
                                    className="p-2 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 rounded-lg transition-all disabled:opacity-50"
                                    title="معاينة التقرير"
                                >
                                    <FileText className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => handleExportSecurityAlertsPDF('download', 'تنبيهات محاولات الاختراق', intrusionAlerts, filter)}
                                    disabled={intrusionAlerts.length === 0}
                                    className="p-2 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 rounded-lg transition-all disabled:opacity-50"
                                    title="تحميل PDF"
                                >
                                    <Download className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl h-[600px] overflow-y-auto custom-scrollbar">
                            <table className="w-full text-right text-sm">
                                <thead className="sticky top-0 bg-slate-900/90 backdrop-blur-md z-10">
                                    <tr className="text-slate-400 font-bold border-b border-white/5">
                                        <th className="px-5 py-4">الهدف / المستخدم</th>
                                        <th className="px-5 py-4">نوع التنبيه</th>
                                        <th className="px-5 py-4 text-left">الوقت</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {loading ? (
                                        <tr><td colSpan={3} className="py-20 text-center text-slate-500">جاري التحميل...</td></tr>
                                    ) : intrusionAlerts.length === 0 ? (
                                        <tr><td colSpan={3} className="py-20 text-center">
                                            <div className="flex flex-col items-center justify-center gap-3 text-slate-500">
                                                <ShieldAlert className="w-8 h-8 opacity-20" />
                                                <p>النظام آمن، لا توجد أي محاولات اختراق مسجلة.</p>
                                            </div>
                                        </td></tr>
                                    ) : (
                                        intrusionAlerts.map((log) => (
                                            <tr key={log.id} className="hover:bg-red-500/[0.02] transition-colors">
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
                                                            <User className="w-4 h-4 text-slate-400" />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-slate-200">{log.username}</p>
                                                            <p className="text-[10px] text-slate-500 font-mono tracking-wider">{log.ip_address}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold text-red-400 bg-red-500/10 border-red-500/20 w-fit">
                                                            <ShieldAlert className="w-4 h-4" />
                                                            {log.action_type === 'ACCOUNT_LOCKED' ? 'تم حظر الحساب (تجاوز المحاولات)' : 'إدخال خاطئ (كلمة مرور)'}
                                                        </div>
                                                        <p className="text-xs text-slate-500">{log.details}</p>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 text-left">
                                                    <div className="flex items-center justify-end gap-2 text-slate-400">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        <span className="font-mono text-xs">{new Date(log.created_at).toLocaleString('ar-SA')}</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
}
