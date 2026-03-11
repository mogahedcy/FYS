'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Database, Server, Key, User, ShieldAlert, CheckCircle2, ArrowRight, ShieldCheck, Lock } from 'lucide-react';

export default function DBConnectPage() {
    const router = useRouter();
    const [authChecked, setAuthChecked] = useState(false);
    const [formData, setFormData] = useState({
        host: 'localhost',
        port: '3306',
        database: '',
        user: 'root',
        password: ''
    });
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    // Guard: Only superadmin can access this page
    useEffect(() => {
        fetch('/api/auth/me')
            .then(r => r.json())
            .then(data => {
                if (!data.success || data.user?.role !== 'superadmin') {
                    router.replace('/');
                } else {
                    setAuthChecked(true);
                }
            })
            .catch(() => router.replace('/'));
    }, [router]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleConnect = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('loading');
        setMessage('');

        try {
            const res = await fetch('/api/db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'connect', ...formData }),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setStatus('success');
                setMessage(data.message);

                localStorage.setItem('dbConnectionSession', data.sessionId);
                localStorage.setItem('dbTargetName', data.dbName);

                setTimeout(() => {
                    router.push('/');
                }, 1500);

            } else {
                setStatus('error');
                setMessage(data.message || 'فشل الاتصال.');
            }
        } catch (error) {
            setStatus('error');
            setMessage('حدث خطأ غير متوقع أثناء الاتصال بالخادم.');
        }
    };

    if (!authChecked) {
        return (
            <div className="min-h-screen bg-[#050811] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-slate-500">
                    <Lock className="w-10 h-10 animate-pulse" />
                    <p className="text-sm font-mono tracking-widest">تحقق من الصلاحيات...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050811] text-slate-200 flex items-center justify-center p-4 font-sans relative overflow-hidden" dir="rtl">

            {/* Ambient Background */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[20%] left-[20%] w-96 h-96 bg-blue-600/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[20%] right-[20%] w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 w-full max-w-xl">
                {/* Back Button */}
                <button
                    onClick={() => router.push('/')}
                    className="mb-8 flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
                >
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    <span>العودة للوحة القيادة</span>
                </button>

                <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] shadow-2xl shadow-black/50 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-600/20 to-transparent p-10 border-b border-white/5">
                        <div className="flex items-center gap-6">
                            <div className="p-4 bg-blue-600 rounded-2xl shadow-lg shadow-blue-900/40">
                                <Database className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-black text-white">إضافة اتصال FYS جديد</h1>
                                <p className="text-slate-400 mt-1">تكوين رابط مشفر مع خادم بيانات خارجي</p>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleConnect} className="p-10 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2 space-y-2">
                                <label className="text-sm font-bold text-slate-400 px-1">عنوان الخادم (Host)</label>
                                <div className="relative">
                                    <Server className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                    <input
                                        type="text"
                                        name="host"
                                        value={formData.host}
                                        onChange={handleChange}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pr-12 pl-4 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition text-left font-mono"
                                        dir="ltr"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-400 px-1">المنفذ (Port)</label>
                                <input
                                    type="text"
                                    name="port"
                                    value={formData.port}
                                    onChange={handleChange}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-4 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition text-left font-mono"
                                    dir="ltr"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-400 px-1">اسم قاعدة البيانات (Database Name)</label>
                            <div className="relative">
                                <ShieldCheck className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                <input
                                    type="text"
                                    name="database"
                                    value={formData.database}
                                    onChange={handleChange}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pr-12 pl-4 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition text-left"
                                    dir="ltr"
                                    placeholder="remote_db_name"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-400 px-1">المستخدم (User)</label>
                                <div className="relative">
                                    <User className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                    <input
                                        type="text"
                                        name="user"
                                        value={formData.user}
                                        onChange={handleChange}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pr-12 pl-4 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition text-left"
                                        dir="ltr"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-400 px-1">كلمة المرور (Password)</label>
                                <div className="relative">
                                    <Key className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                    <input
                                        type="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pr-12 pl-4 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition text-left font-mono"
                                        dir="ltr"
                                    />
                                </div>
                            </div>
                        </div>

                        {status === 'error' && (
                            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-sm animate-pulse">
                                <ShieldAlert className="w-5 h-5 shrink-0" />
                                <p>{message}</p>
                            </div>
                        )}

                        {status === 'success' && (
                            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-400 text-sm">
                                <CheckCircle2 className="w-5 h-5 shrink-0" />
                                <p>{message}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={status === 'loading'}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-900/40 transition-all hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg"
                        >
                            {status === 'loading' ? (
                                <>
                                    <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>جاري التحقق من التشفير...</span>
                                </>
                            ) : (
                                <>
                                    <ShieldCheck className="w-6 h-6" />
                                    <span>تأسيس الاتصال الآمن</span>
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <div className="mt-8 p-6 bg-white/5 border border-white/5 rounded-2xl text-center">
                    <p className="text-xs text-slate-500 font-mono tracking-widest uppercase">
                        Secure Gateway Node Identifier: NODE-DX-99
                    </p>
                </div>
            </div>
        </div>
    );
}
