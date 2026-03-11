'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DatabaseBackup, Trash2, DownloadCloud, ShieldCheck, AlertTriangle, Play, RefreshCw, Layers, RotateCcw, Clock, Save } from 'lucide-react';

export default function BackupsPage() {
    const router = useRouter();
    const [backups, setBackups] = useState<any[]>([]);
    const [settings, setSettings] = useState({
        auto_backup_enabled: false,
        auto_backup_interval_hours: 24
    });
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const fetchBackups = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/backups');
            const data = await res.json();
            if (res.ok && data.success) {
                setBackups(data.backups);
                setStats(data.stats);
            } else {
                setError(data.message || 'حدث خطأ في جلب النسخ الاحتياطية');
            }
        } catch {
            setError('فشل الاتصال بالخادم');
        } finally {
            setLoading(false);
        }
    };

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/backups/settings');
            const data = await res.json();
            if (res.ok && data.success && data.settings) {
                setSettings({
                    auto_backup_enabled: data.settings.auto_backup_enabled,
                    auto_backup_interval_hours: data.settings.auto_backup_interval_hours
                });
            }
        } catch {
            console.error('Failed to fetch settings');
        }
    };

    useEffect(() => {
        fetchBackups();
        fetchSettings();
    }, []);

    const saveSettings = async () => {
        setActionLoading(true);
        try {
            const res = await fetch('/api/backups/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            const data = await res.json();
            if (res.ok && data.success) {
                showSuccess(data.message);
            } else {
                alert(data.message || 'فشل حفظ الإعدادات');
            }
        } catch {
            alert('حدث خطأ أثناء الاتصال بالخادم لحفظ الإعدادات.');
        } finally {
            setActionLoading(false);
        }
    };

    const showSuccess = (msg: string) => {
        setSuccessMsg(msg);
        setTimeout(() => setSuccessMsg(''), 4000);
    };

    const handleCreateBackup = async () => {
        setActionLoading(true);
        try {
            const res = await fetch('/api/backups', { method: 'POST' });
            const data = await res.json();
            if (res.ok && data.success) {
                showSuccess(data.message);
                fetchBackups();
            } else {
                alert(data.message || 'فشل إنشاء النسخة الاحتياطية');
            }
        } catch {
            alert('حدث خطأ أثناء الاتصال بالخادم لإنشاء النسخة.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteBackup = async (id: number) => {
        if (!confirm('النسخ الاحتياطية المحذوفة لا يمكن استرجاعها أبداً. تأكيد الحذف النهائي؟')) return;
        setActionLoading(true);
        try {
            const res = await fetch(`/api/backups/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok && data.success) {
                showSuccess(data.message);
                fetchBackups();
            } else {
                alert(data.message || 'فشل حذف النسخة الاحتياطية');
            }
        } catch {
            alert('حدث خطأ أثناء إرسال طلب الحذف.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDownloadBackup = (id: number, filePath: string) => {
        // Direct trigger via window.open/anchor to download file
        const url = `/api/backups/${id}/download`;
        const a = document.createElement('a');
        a.href = url;
        // Extracts the actual filename securely
        const filename = filePath.split('\\').pop()?.split('/').pop() || 'backup.db';
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const handleRestoreBackup = async (id: number) => {
        if (!confirm('تحذير شديد الأهمية! استرجاع هذه النسخة سيقوم بمسح كافة البيانات والإعدادات الحالية وإرجاع النظام إلى الحالة التي كان عليها وقت أخذ هذه النسخة. هل أنت متأكد من رغبتك في الاسترجاع؟')) return;
        setActionLoading(true);
        try {
            const res = await fetch(`/api/backups/${id}/restore`, { method: 'POST' });
            const data = await res.json();
            if (res.ok && data.success) {
                showSuccess(data.message);
                // Force reload page to guarantee fresh state
                setTimeout(() => window.location.reload(), 2000);
            } else {
                alert(data.message || 'فشل استرجاع النسخة الاحتياطية');
            }
        } catch {
            alert('حدث خطأ أثناء عملية الاسترجاع المغلقة.');
        } finally {
            setActionLoading(false);
        }
    };

    if (loading && !backups.length) return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-500 text-lg">جاري التحميل...</div>;

    return (
        <div className="min-h-screen bg-slate-50 p-6" dir="rtl">
            {/* Header */}
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between mb-8 bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-4 mb-4 md:mb-0">
                    <div className="bg-emerald-100 p-3 rounded-2xl">
                        <DatabaseBackup className="w-8 h-8 text-emerald-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">إدارة النسخ الاحتياطية</h1>
                        <p className="text-sm text-slate-500 font-medium mt-1">
                            تأمين وحفظ بيانات المنظومة محلياً من الفقدان والانهيار
                        </p>
                    </div>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <button
                        onClick={fetchBackups}
                        className="flex-1 md:flex-none flex justify-center items-center gap-2 px-5 py-2.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors font-medium text-sm"
                    >
                        <RefreshCw className={`w-4 h-4 ${actionLoading ? 'animate-spin' : ''}`} />
                        تحديث الرد
                    </button>
                    <button
                        onClick={() => router.push('/')}
                        className="flex-1 md:flex-none px-6 py-2.5 text-slate-600 border-2 border-slate-200 hover:bg-slate-50 rounded-xl transition-colors font-bold text-sm"
                    >
                        عودة للوحة القيادة
                    </button>
                </div>
            </div>

            <div className="max-w-6xl mx-auto space-y-6">
                {/* Stats & Error/Success Alerts */}
                {error && (
                    <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-2xl flex items-center gap-3">
                        <AlertTriangle className="w-6 h-6 shrink-0" />
                        <span className="font-semibold">{error}</span>
                    </div>
                )}
                {successMsg && (
                    <div className="p-4 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
                        <ShieldCheck className="w-6 h-6 shrink-0" />
                        <span className="font-semibold">{successMsg}</span>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Action Card */}
                    <div className="col-span-1 md:col-span-1 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
                            <Layers className="w-8 h-8" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mb-2">تأمين المنظومة محلياً</h2>
                        <p className="text-sm text-slate-500 mb-6 px-4 leading-relaxed">
                            قم بأخذ لقطة فورية لقاعدة بيانات النظام وملفات السجلات المعزولة لحفظها والاحتفاظ بها كنسخة محلية.
                        </p>
                        <button
                            onClick={handleCreateBackup}
                            disabled={actionLoading}
                            className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-md shadow-blue-600/20 active:scale-[0.98]"
                        >
                            <Play className="w-5 h-5 fill-white" />
                            {actionLoading ? 'جاري التأمين...' : 'إنشاء نسخة احتياطية فورية'}
                        </button>

                        {/* Scheduled Backups Settings */}
                        <div className="w-full mt-6 pt-6 border-t border-slate-100/50">
                            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 mb-4 justify-center">
                                <Clock className="w-4 h-4 text-emerald-500" />
                                أوامر النسخ الاحتياطي التلقائي
                            </h3>
                            <div className="flex flex-col gap-3 text-right">
                                <label className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                                    <span className="text-sm font-bold text-slate-700">تفعيل النسخ المجدول</span>
                                    <div className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            className="sr-only peer" 
                                            checked={settings.auto_backup_enabled}
                                            onChange={(e) => setSettings({...settings, auto_backup_enabled: e.target.checked})}
                                        />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                    </div>
                                </label>
                                
                                {settings.auto_backup_enabled && (
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs text-slate-500 font-bold">كل كم ساعة يتم أخذ نسخة؟</label>
                                        <select 
                                            value={settings.auto_backup_interval_hours}
                                            onChange={(e) => setSettings({...settings, auto_backup_interval_hours: parseFloat(e.target.value)})}
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500"
                                        >
                                            <option value="1">كل ساعة (1H)</option>
                                            <option value="6">كل 6 ساعات (6H)</option>
                                            <option value="12">كل 12 ساعة (NIGHTLY)</option>
                                            <option value="24">كل 24 ساعة (DAILY)</option>
                                            <option value="168">كل أسبوع (WEEKLY)</option>
                                        </select>
                                    </div>
                                )}
                                <button
                                    onClick={saveSettings}
                                    disabled={actionLoading}
                                    className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition-all text-sm shadow-md"
                                >
                                    <Save className="w-4 h-4" />
                                    حفظ إعدادات المجدول
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Stats List */}
                    <div className="col-span-1 md:col-span-2 bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm flex flex-col">
                        <div className="p-5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                <DatabaseBackup className="w-5 h-5 text-slate-500" /> سجل وأرشيف النسخ
                            </h2>
                            {stats && (
                                <div className="text-xs font-bold bg-slate-200 text-slate-600 px-3 py-1.5 rounded-full flex items-center gap-2">
                                    <span>الإجمالي: {stats.total}</span>
                                    <span className="text-slate-400">|</span>
                                    <span className={stats.valid < stats.total ? 'text-amber-600' : 'text-emerald-600'}>سليمة ومادية: {stats.valid}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 overflow-x-auto">
                            <table className="w-full text-right text-sm">
                                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                                    <tr>
                                        <th className="px-5 py-4 w-16 text-center">#</th>
                                        <th className="px-5 py-4">معرّف النسخة / المسار</th>
                                        <th className="px-5 py-4">بواسطة</th>
                                        <th className="px-5 py-4">التاريخ والوقت</th>
                                        <th className="px-5 py-4 text-center">الإجراءات الخاضعة</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {backups.map((backup, i) => {
                                        const originalName = backup.file_path.split('\\').pop()?.split('/').pop() || 'Unknown';
                                        const dt = new Date(backup.created_at);
                                        return (
                                            <tr key={backup.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-5 py-4 text-center font-bold text-slate-400">{i + 1}</td>
                                                <td className="px-5 py-4 text-slate-700">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="font-bold text-slate-800 font-mono text-xs" dir="ltr">{originalName}</span>
                                                        {!backup.fileExists && (
                                                            <span className="text-[10px] text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded-full w-max">الملف المادي مفقود!</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full text-xs font-bold border border-indigo-100">
                                                        @{backup.created_by || 'System'}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 text-slate-500 font-medium">
                                                    <div className="flex flex-col">
                                                        <span dir="ltr">{dt.toLocaleDateString('en-GB')}</span>
                                                        <span className="text-xs text-slate-400 font-mono" dir="ltr">{dt.toLocaleTimeString()}</span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 text-center whitespace-nowrap">
                                                    <div className="flex items-center justify-center gap-2 opacity-100 md:opacity-50 md:group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => handleRestoreBackup(backup.id)}
                                                            disabled={!backup.fileExists || actionLoading}
                                                            className={`p-2 rounded-xl transition-all border ${backup.fileExists ? 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-600 hover:text-white' : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'}`}
                                                            title="استرجاع النظام"
                                                        >
                                                            <RotateCcw className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDownloadBackup(backup.id, backup.file_path)}
                                                            disabled={!backup.fileExists || actionLoading}
                                                            className={`p-2 rounded-xl transition-all border ${backup.fileExists ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-600 hover:text-white' : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'}`}
                                                            title="سحب (تنزيل) محلي"
                                                        >
                                                            <DownloadCloud className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteBackup(backup.id)}
                                                            disabled={actionLoading}
                                                            className="p-2 bg-red-50 text-red-500 border border-red-100 hover:bg-red-600 hover:text-white rounded-xl transition-all"
                                                            title="تدمير النسخة"
                                                        >
                                                            <Trash2 className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {backups.length === 0 && !loading && (
                                        <tr>
                                            <td colSpan={5} className="px-5 py-16 text-center text-slate-400">
                                                <DatabaseBackup className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                                                لا توجد نسخ احتياطية مسجلة حالياً في الأرشيف الآمن.
                                            </td>
                                        </tr>
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
