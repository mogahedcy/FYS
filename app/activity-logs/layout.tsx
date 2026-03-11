'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Activity, ShieldCheck, Database, Wifi, WifiOff, Bell, X, Users, Home, Clock, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

export default function ActivityLogsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [dbName, setDbName] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState<boolean>(true);
    const [isSetup, setIsSetup] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [liveAlerts, setLiveAlerts] = useState<any[]>([]);
    const lastLogIdRef = useRef<number>(0);

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

        const pingInterval = setInterval(() => {
            pingDatabase(storedSessionId);
            fetchNewLogs(storedSessionId);
        }, 3000);

        return () => clearInterval(pingInterval);
    }, [router]);

    const pingDatabase = async (sid: string) => {
        try {
            const res = await fetch('/api/db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'check_connection', sessionId: sid }),
            });
            const data = await res.json();
            setIsConnected(data.connected);
        } catch (err) {
            setIsConnected(false);
        }
    };

    const checkSetup = async (sid: string) => {
        try {
            const res = await fetch('/api/db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'check_logs_setup', sessionId: sid }),
            });
            const data = await res.json();
            if (data.success) {
                setIsSetup(data.isSetup);
                // Initial fetch to get the lastLogId
                if (data.isSetup) {
                    const logsRes = await fetch('/api/db', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'get_logs', sessionId: sid, limit: 1 }),
                    });
                    const logsData = await logsRes.json();
                    if (logsData.success && logsData.logs?.length > 0) {
                        lastLogIdRef.current = Math.max(...logsData.logs.map((l: any) => l.id));
                    }
                }
            }
        } catch (err) {
            console.error('Setup check failed');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchNewLogs = async (sid: string) => {
        if (!lastLogIdRef.current) return;
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
                setLiveAlerts(prev => [...data.newLogs, ...prev].slice(0, 5));
            }
        } catch (err) {
            console.error('Failed to fetch new logs', err);
        }
    };

    const navItems = [
        { name: 'العرض المباشر', href: '/activity-logs/live', icon: Database },
        { name: 'إعداد المشغلات', href: '/activity-logs/triggers', icon: ShieldCheck },
        { name: 'تتبع المستخدمين', href: '/activity-logs/users', icon: Users },
        { name: 'مستخدمي قاعدة البيانات', href: '/activity-logs/db-users', icon: ShieldCheck },
        { name: 'سجل الاتصالات', href: '/activity-logs/history', icon: Clock },
        { name: 'مركز الأمن', href: '/activity-logs/security', icon: ShieldAlert },
    ];

    return (
        <div className="min-h-screen bg-[#0B1120] text-slate-200 p-6 flex flex-col font-sans" dir="rtl">
            {/* Live Alerts Overlay */}
            <div className="fixed top-6 left-6 z-50 flex flex-col gap-3 pointer-events-none" dir="rtl">
                {liveAlerts.map(alert => {
                    const isLogin = alert.action_type === 'INSERT' && (alert.table_name.toLowerCase().includes('user') || alert.table_name.toLowerCase().includes('admin'));
                    const isLogout = alert.action_type === 'DELETE' && (alert.table_name.toLowerCase().includes('user') || alert.table_name.toLowerCase().includes('session'));

                    return (
                        <div key={`alert-${alert.id}`} className={`pointer-events-auto border-r-4 shadow-[0_10px_40px_rgba(0,0,0,0.5)] p-4 rounded-xl w-80 text-white animate-in slide-in-from-left-8 fade-in flex items-start gap-4 ${isLogin ? 'bg-indigo-900/95 border-indigo-400' :
                            isLogout ? 'bg-red-900/95 border-red-500' :
                                'bg-slate-900/95 border-emerald-500'
                            }`}>
                            <div className={`${isLogin ? 'bg-indigo-500/20' : isLogout ? 'bg-red-500/20' : 'bg-emerald-500/20'} p-2 rounded-lg`}>
                                <Bell className={`w-5 h-5 animate-pulse ${isLogin ? 'text-indigo-400' : isLogout ? 'text-red-400' : 'text-emerald-400'}`} />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <h4 className="font-bold text-sm">
                                        {isLogin ? '🔔 تسجيل دخول جديد' : isLogout ? '🚪 تسجيل خروج' : `نشاط في ${alert.table_name}`}
                                    </h4>
                                    <button onClick={() => setLiveAlerts(prev => prev.filter(a => a.id !== alert.id))} className="text-slate-500 hover:text-white transition"><X className="w-4 h-4" /></button>
                                </div>
                                <p className="text-xs text-slate-400 mt-1 line-clamp-2" dir="ltr">
                                    {isLogin ? `مستخدم جديد انضم في جدول ${alert.table_name}` : alert.action_type} - {new Date(alert.action_timestamp).toLocaleTimeString()}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="max-w-7xl w-full mx-auto flex-1 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between mb-8 bg-slate-800/50 backdrop-blur-md p-6 rounded-2xl border border-slate-700/50 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />

                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                            <Activity className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white tracking-tight">سجلات النشاط والمراقبة (Audit Logs)</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border font-medium text-xs ${isConnected ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400 animate-pulse'}`}>
                                    {isConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                                    {isConnected ? 'متصل' : 'فشل الاتصال'}
                                </div>
                                <span className="text-slate-400 text-xs font-mono">• (DB: {dbName})</span>
                            </div>
                        </div>
                    </div>
                    <Link
                        href="/"
                        className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 rounded-lg text-sm font-medium transition-all relative z-10 flex items-center gap-2"
                    >
                        <Home className="w-4 h-4" />
                        العودة للرئيسية
                    </Link>
                </div>

                {/* Navigation Tabs */}
                {isSetup && (
                    <div className="flex bg-slate-800/40 p-1.5 rounded-xl border border-slate-700/50 w-full max-w-4xl mx-auto mb-8">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${item.href === '/activity-logs/security'
                                            ? isActive ? 'bg-red-600 text-white shadow-lg shadow-red-900/40' : 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
                                            : isActive ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                                        }`}
                                >
                                    <Icon className="w-4 h-4" /> {item.name}
                                </Link>
                            );
                        })}
                    </div>
                )}

                {/* Main Content */}
                <div className="flex-1 flex flex-col">
                    {children}
                </div>
            </div>
        </div>
    );
}
