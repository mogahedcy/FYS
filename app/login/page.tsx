'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, User, Key, AlertCircle } from 'lucide-react';

export default function LoginPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({ username: '', password: '' });
    const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('loading');
        setMessage('');

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setStatus('idle');
                router.push('/');
                router.refresh(); // Refresh to trigger middleware correctly
            } else {
                setStatus('error');
                setMessage(data.message || 'فشل تسجيل الدخول.');
            }
        } catch (error) {
            setStatus('error');
            setMessage('حدث خطأ غير متوقع. يرجى المحاولة لاحقاً.');
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 selection:bg-blue-500/30" dir="rtl">

            {/* Abstract Background Shapes */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl -translate-y-1/2" />
                <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
            </div>

            <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl shadow-black/50 w-full max-w-md p-8 relative z-10">

                <div className="flex flex-col items-center mb-8 text-white">
                    <div className="mb-6">
                        <img
                            src="/fidral.png"
                            alt="FYS Logo"
                            className="w-24 h-24 object-contain drop-shadow-[0_0_20px_rgba(59,130,246,0.5)]"
                        />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2">FYS Security System</h1>
                    <p className="text-slate-400 text-sm text-center">
                        يرجى تسجيل الدخول للوصول إلى لوحة التحكم
                    </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300 block ml-1">اسم المستخدم</label>
                        <div className="relative group">
                            <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-400 transition-colors pointer-events-none" />
                            <input
                                type="text"
                                name="username"
                                value={formData.username}
                                onChange={handleChange}
                                className="w-full pl-4 pr-11 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all text-white placeholder-slate-600 text-left"
                                dir="ltr"
                                placeholder="admin"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300 block ml-1">كلمة المرور</label>
                        <div className="relative group">
                            <Key className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-400 transition-colors pointer-events-none" />
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                className="w-full pl-4 pr-11 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all text-white placeholder-slate-600 text-left font-mono tracking-widest"
                                dir="ltr"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    {status === 'error' && (
                        <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-sm animate-in fade-in slide-in-from-top-2">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <p>{message}</p>
                        </div>
                    )}

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={status === 'loading'}
                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-3.5 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all hover:shadow-[0_0_25px_rgba(37,99,235,0.5)] hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3 group"
                        >
                            {status === 'loading' ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>جاري التحقق...</span>
                                </>
                            ) : (
                                <>
                                    <span>تسجيل الدخول</span>
                                    <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                                        <svg className="w-3 h-3 translate-y-[0.5px] -translate-x-[0.5px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                        </svg>
                                    </div>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
