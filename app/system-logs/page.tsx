'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, ArrowRight, ShieldAlert, User, Clock, FileText, CheckCircle2, Download } from 'lucide-react';
import { handleExportSystemLogsPDF } from '../activity-logs/utils/pdfGenerator';

interface SystemLog {
    id: number;
    user_id: number;
    username: string;
    action_type: string;
    details: string;
    ip_address: string;
    created_at: string;
}

export default function SystemLogsPage() {
    const router = useRouter();
    const [logs, setLogs] = useState<SystemLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [usersList, setUsersList] = useState<string[]>([]);

    useEffect(() => {
        fetchUsersList();
    }, []);

    useEffect(() => {
        fetchLogs();
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

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/system-logs?username=${filter}`);
            const data = await res.json();
            if (data.success) {
                setLogs(data.logs);
            }
        } catch (error) {
            console.error('Failed to fetch system logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const getActionColor = (type: string) => {
        if (type === 'LOGIN_SUCCESS') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
        if (type === 'LOGOUT') return 'text-sky-400 bg-sky-500/10 border-sky-500/20';
        if (type === 'LOGIN_FAILED') return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
        if (type === 'ACCOUNT_LOCKED') return 'text-red-400 bg-red-500/10 border-red-500/20';
        if (type === 'DB_CONNECTED') return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
        if (type === 'DB_DISCONNECTED') return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
        if (type === 'DB_HARD_DELETED') return 'text-red-500 bg-red-500/15 border-red-500/30';
        if (type === 'USER_CREATED') return 'text-violet-400 bg-violet-500/10 border-violet-500/20';
        if (type === 'USER_UPDATED') return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
        if (type === 'USER_DELETED') return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
        if (type === 'USER_UNLOCKED') return 'text-teal-400 bg-teal-500/10 border-teal-500/20';
        if (type === 'MONITORING_SETUP') return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
        if (type === 'TRIGGER_ADDED' || type === 'TRIGGER_BULK_ADDED') return 'text-lime-400 bg-lime-500/10 border-lime-500/20';
        if (type === 'TRIGGER_REMOVED') return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
        if (type === 'DB_USER_CREATED') return 'text-green-400 bg-green-500/10 border-green-500/20';
        if (type === 'DB_USER_DELETED') return 'text-red-400 bg-red-500/10 border-red-500/20';
        if (type === 'DB_PERMISSIONS_UPDATED') return 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20';
        if (type === 'DB_USER_PASSWORD_CHANGED') return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
        if (type === 'BACKUP_SETTINGS_UPDATED') return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
        if (type.includes('BACKUP')) return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
        return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    };

    const getActionLabel = (type: string) => {
        const labels: Record<string, string> = {
            'LOGIN_SUCCESS': 'دخول ناجح',
            'LOGOUT': 'خروج من النظام',
            'LOGIN_FAILED': 'محاولة دخول فاشلة',
            'ACCOUNT_LOCKED': 'حساب محظور',
            'DB_CONNECTED': 'إضافة قاعدة بيانات',
            'DB_DISCONNECTED': 'إزالة اتصال (أرشيف)',
            'DB_HARD_DELETED': 'حذف جذري لقاعدة بيانات',
            'USER_CREATED': 'إنشاء مستخدم جديد',
            'USER_UPDATED': 'تعديل بيانات مستخدم',
            'USER_DELETED': 'حذف مستخدم',
            'USER_UNLOCKED': 'فك حظر مستخدم',
            'BACKUP_CREATED': 'إنشاء نسخة احتياطية',
            'BACKUP_RESTORED': 'استرداد نسخة احتياطية',
            'BACKUP_DELETED': 'حذف نسخة احتياطية',
            'BACKUP_SETTINGS_UPDATED': 'تحديث إعدادات النسخ التلقائي',
            'MONITORING_SETUP': 'تهيئة نظام المراقبة',
            'TRIGGER_ADDED': 'تفعيل مراقبة جدول (Trigger)',
            'TRIGGER_BULK_ADDED': 'تفعيل مراقبة شاملة لجميع الجداول',
            'TRIGGER_REMOVED': 'إيقاف مراقبة جدول',
            'DB_PERMISSIONS_UPDATED': 'تعديل صلاحيات مستخدم DB',
            'DB_USER_CREATED': 'إنشاء مستخدم في قاعدة البيانات',
            'DB_USER_DELETED': 'حذف مستخدم من قاعدة البيانات',
            'DB_USER_PASSWORD_CHANGED': 'تغيير كلمة مرور مستخدم DB',
        };
        return labels[type] || type;
    };

    const getActionIcon = (type: string) => {
        if (type === 'LOGIN_SUCCESS' || type === 'USER_UNLOCKED') return <CheckCircle2 className="w-4 h-4" />;
        if (type === 'LOGIN_FAILED' || type === 'ACCOUNT_LOCKED' || type === 'DB_HARD_DELETED') return <ShieldAlert className="w-4 h-4" />;
        return <Activity className="w-4 h-4" />;
    };

    return (
        <div className="min-h-screen bg-[#0A0F1C] text-slate-200 p-8 font-sans selection:bg-blue-500/30" dir="rtl">
            <div className="max-w-6xl mx-auto flex flex-col gap-8">
                
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
                                <Activity className="w-7 h-7 text-blue-500" />
                                سجل نشاط النظام الأمني
                            </h1>
                            <p className="text-slate-400 mt-1 text-sm">
                                مراقبة عمليات الدخول والخروج ومحاولات الاختراق المحلية (Local Activity)
                            </p>
                        </div>
                    </div>
                </div>

                {/* Filters & Actions */}
                <div className="flex items-center justify-between bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
                    <div className="flex items-center gap-4">
                        <select 
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500/50 text-sm text-slate-300"
                        >
                            <option value="all">جميع المشرفين</option>
                            {usersList.map(u => (
                                <option key={u} value={u}>المشرف {u}</option>
                            ))}
                        </select>
                        <span className="text-xs text-slate-500 font-mono">
                            إجمالي السجلات المستردة: {logs.length}
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => handleExportSystemLogsPDF('preview', logs, filter === 'all' ? null : filter)}
                            disabled={logs.length === 0}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 rounded-xl transition-all text-sm font-bold disabled:opacity-50"
                        >
                            <FileText className="w-4 h-4" />
                            معاينة
                        </button>
                        <button 
                            onClick={() => handleExportSystemLogsPDF('download', logs, filter === 'all' ? null : filter)}
                            disabled={logs.length === 0}
                            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white border border-blue-500/30 rounded-xl transition-all text-sm font-bold shadow-lg shadow-blue-900/20 disabled:opacity-50"
                        >
                            <Download className="w-4 h-4" />
                            تحميل PDF
                        </button>
                    </div>
                </div>

                {/* Logs Table */}
                <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-sm">
                            <thead>
                                <tr className="bg-white/5 text-slate-400 font-bold border-b border-white/5">
                                    <th className="px-6 py-5 whitespace-nowrap">رقم الحدث</th>
                                    <th className="px-6 py-5 whitespace-nowrap">المشرف</th>
                                    <th className="px-6 py-5 whitespace-nowrap">نوع الحدث</th>
                                    <th className="px-6 py-5 w-full">التفاصيل</th>
                                    <th className="px-6 py-5 whitespace-nowrap text-left">التاريخ والوقت</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="py-20 text-center">
                                            <div className="flex flex-col items-center justify-center gap-4 text-slate-500">
                                                <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                                                <p>جاري جلب السجلات الأمنية...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-20 text-center">
                                            <div className="flex flex-col items-center justify-center gap-3 text-slate-500">
                                                <ShieldAlert className="w-10 h-10 opacity-20" />
                                                <p>لا توجد سجلات نشاط مسجلة في هذا النطاق.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map((log) => (
                                        <tr key={log.id} className="hover:bg-blue-500/[0.02] transition-colors group">
                                            <td className="px-6 py-4 font-mono text-slate-500">#{log.id}</td>
                                            <td className="px-6 py-4">
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
                                            <td className="px-6 py-4">
                                                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold ${getActionColor(log.action_type)}`}>
                                                    {getActionIcon(log.action_type)}
                                                    {getActionLabel(log.action_type)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-400">
                                                {log.details}
                                            </td>
                                            <td className="px-6 py-4 text-left">
                                                <div className="flex items-center justify-end gap-2 text-slate-400">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    <span className="font-mono text-xs">
                                                        {new Date(log.created_at).toLocaleString('ar-SA')}
                                                    </span>
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
    );
}
