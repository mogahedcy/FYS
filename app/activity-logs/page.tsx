'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, Database, Loader2 } from 'lucide-react';

export default function ActivityLogsDashboard() {
    const router = useRouter();
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [dbName, setDbName] = useState<string | null>(null);
    const [isSetup, setIsSetup] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        const storedSessionId = localStorage.getItem('dbConnectionSession');
        const storedDbName = localStorage.getItem('dbTargetName');

        if (!storedSessionId) {
            router.push('/db-admin');
            return;
        }

        setSessionId(storedSessionId);
        setDbName(storedDbName);

        checkSetup(storedSessionId);
    }, [router]);

    const checkSetup = async (sid: string) => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'check_logs_setup', sessionId: sid }),
            });
            const data = await res.json();
            if (data.success) {
                if (data.isSetup) {
                    router.push('/activity-logs/live');
                } else {
                    setIsSetup(false);
                }
            } else {
                setMessage({ type: 'error', text: data.message });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'خطأ في الاتصال بالخادم.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateSetup = async () => {
        if (!sessionId) return;
        setIsActionLoading(true);
        try {
            const res = await fetch('/api/db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'setup_logs_table', sessionId }),
            });
            const data = await res.json();
            if (data.success) {
                setIsSetup(true);
                router.push('/activity-logs/live');
            } else {
                setMessage({ type: 'error', text: data.message });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'حدث خطأ أثناء الإنشاء.' });
        } finally {
            setIsActionLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-20 text-emerald-400">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 animate-spin" />
                    <p className="font-medium animate-pulse">جاري التحقق من نظام المراقبة...</p>
                </div>
            </div>
        );
    }

    if (!isSetup) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-10 bg-slate-800/30 border border-slate-700/40 rounded-3xl relative overflow-hidden">
                <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
                <Activity className="w-24 h-24 text-slate-600 mb-6 drop-shadow-2xl" />
                <h2 className="text-3xl font-extrabold text-white mb-4">نظام المراقبة غير مُفعّل</h2>
                <p className="text-slate-400 max-w-lg mb-10 text-lg leading-relaxed">
                    لتتمكن من مراقبة حركات وتعديلات مستخدمي التطبيق الخاص بك، يجب بناء الجداول المركزية لتسجيل وتوثيق البيانات في قاعدة ({dbName}).
                </p>
                {message.text && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl">
                        {message.text}
                    </div>
                )}
                <button
                    onClick={handleCreateSetup}
                    disabled={isActionLoading}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-xl font-bold transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                    {isActionLoading ? (
                        <><Loader2 className="w-6 h-6 animate-spin" /> جاري التأسيس والتجهيز...</>
                    ) : (
                        <><Database className="w-6 h-6 group-hover:scale-110 transition-transform" /> تفعيل نظام المراقبة وبناء الجداول</>
                    )}
                </button>
            </div>
        );
    }

    return null;
}
