'use client';

import { useRouter } from 'next/navigation';
import {
  Database, Users, ShieldCheck, LogOut, ArrowLeft, Activity, Server, Lock,
  ExternalLink, Plus, RefreshCw, FileText, Settings, ShieldAlert,
  BarChart3, Signal, Trash2, LayoutDashboard, Terminal,
  History, UserCheck, Zap
} from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';

interface Connection {
  id: number;
  sessionId: string;
  host: string;
  database_name: string;
  username: string;
  status: string;
  first_connected_at: string;
  last_seen_at: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [user, setUser] = useState<{ id: number, username: string, role: string, assigned_db?: string } | null>(null);
  const [activeDbName, setActiveDbName] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingId, setCheckingId] = useState<number | null>(null);

  const [stats, setStats] = useState({
    active: 0,
    total: 0,
    alerts: 0
  });
  const [recentSystemLogs, setRecentSystemLogs] = useState<{id:number, username:string, action_type:string, details:string, created_at:string}[]>([]);

  const fetchConnections = useCallback(async () => {
    try {
      const resp = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh_all_connections' })
      });
      const data = await resp.json();
      if (data.success) {
        setConnections(data.history);
        const active = data.history.filter((c: Connection) => c.status === 'active').length;
        setStats({
          active,
          total: data.history.length,
          alerts: 0
        });
      }
    } catch (e) {
      console.error("Failed to fetch connections", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUser = useCallback(async () => {
    try {
      const resp = await fetch('/api/auth/me');
      const data = await resp.json();
      if (data.success && data.user) {
        setUser(data.user);
      }
    } catch (e) {
      console.error("Failed to fetch user", e);
    }
  }, []);

  const checkStatus = useCallback(async (sessionId: string) => {
    try {
      const resp = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_connection', sessionId })
      });
      const data = await resp.json();
      return data.connected;
    } catch (e) {
      return false;
    }
  }, []);

  useEffect(() => {
    setIsMounted(true);
    const storedDbName = localStorage.getItem('dbTargetName');
    const storedSessionId = localStorage.getItem('dbConnectionSession');
    if (storedDbName) setActiveDbName(storedDbName);
    if (storedSessionId) setActiveSessionId(storedSessionId);

    fetchUser().then(() => {
      fetchConnections();
      // Fetch recent system logs for the analytics panel
      fetch('/api/system-logs?limit=6')
        .then(r => r.json())
        .then(d => { if (d.success) setRecentSystemLogs(d.logs || []); })
        .catch(() => {});
    });

    const timer = setInterval(fetchConnections, 45000);
    return () => clearInterval(timer);
  }, [fetchConnections]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const handleSelectDb = (conn: Connection) => {
    localStorage.setItem('dbTargetName', conn.database_name);
    localStorage.setItem('dbConnectionSession', conn.sessionId);
    setActiveDbName(conn.database_name);
    setActiveSessionId(conn.sessionId);
    // Maybe show a success toast or notification
  };

  const navigateToFunction = (path: string, conn: Connection) => {
    // Ensure we are working with this DB
    localStorage.setItem('dbTargetName', conn.database_name);
    localStorage.setItem('dbConnectionSession', conn.sessionId);
    router.push(path);
  };

  if (!isMounted) return null;

  // Filter connections based on role
  const displayConnections = user?.role === 'monitor' && user?.assigned_db
    ? connections.filter(c => c.database_name === user.assigned_db)
    : connections;

  const handleManualCheck = async (conn: Connection) => {
    setCheckingId(conn.id);
    try {
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_connection', sessionId: conn.sessionId })
      });
      const data = await res.json();
      if (data.success && typeof data.connected === 'boolean') {
        if (data.connected) {
          // Success Feedback
        } else {
          alert('فشل الاتصال: ' + (data.message || 'القاعدة غير مستجيبة.'));
        }
      } else {
          alert('تعذر الوصول للخادم.');
      }
    } catch (error) {
       alert('تعذر الفحص في الوقت الحالي.');
    } finally {
      setCheckingId(null);
      fetchConnections(); // refresh the UI immediately
    }
  };

  return (
    <div className="min-h-screen bg-[#050811] text-slate-200 selection:bg-blue-500/30 font-sans" dir="rtl">

      {/* Animated Cyber Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-900/10 rounded-full blur-[160px] animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-indigo-900/10 rounded-full blur-[160px]" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]" />
      </div>

      <div className="relative z-10 p-4 md:p-8 max-w-[1600px] mx-auto min-h-screen flex flex-col gap-8">

        {/* Top Navigation / Header */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-6 bg-slate-900/40 backdrop-blur-xl border border-white/5 p-6 rounded-[2rem] shadow-2xl shadow-black/50">
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-30 rounded-full animate-pulse"></div>
              <div className="relative p-1 rounded-2xl group">
                <img
                  src="/fidral.png"
                  alt="FYS Logo"
                  className="w-16 h-16 object-contain drop-shadow-[0_0_15px_rgba(59,130,246,0.5)] group-hover:scale-110 transition-transform duration-500"
                />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-l from-white to-blue-400 tracking-tight">
                Federal Yemen Security (FYS)
              </h1>
              <p className="text-slate-400 font-medium mt-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                نظام حماية وإدارة الأصول الرقمية (FYS v2.0)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end px-4 border-r border-white/10">
              <span className="text-xs text-slate-500">{user?.role === 'superadmin' ? 'المشرف الحالي' : 'مراقب قواعد بيانات'}</span>
              <span className="text-sm font-bold text-blue-400">
                {user?.username.toUpperCase() || 'USER'} {user?.role === 'superadmin' ? '(Super)' : ''}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-6 py-3 text-slate-300 bg-white/5 hover:bg-red-500/10 hover:text-red-400 border border-white/5 hover:border-red-500/30 rounded-2xl transition-all duration-300 font-bold backdrop-blur-md group"
            >
              <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              إنهاء الجلسة الآمنة
            </button>
          </div>
        </header>

        {/* Dash Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">

          {/* Right Column: Mini Stats & Quick Actions */}
          <div className="xl:col-span-1 flex flex-col gap-6">

            {/* System Health Card */}
            <div className="bg-gradient-to-br from-slate-900/80 to-slate-950 border border-white/5 p-6 rounded-[2rem] shadow-xl overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Activity className="w-24 h-24" />
              </div>
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-500" />
                إحصائيات المنظومة
              </h3>
              <div className="space-y-4 relative z-10">
                <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-slate-400">قواعد البيانات</span>
                  <span className="text-blue-400 font-bold text-xl">{stats.total}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-slate-400">اتصالات نشطة</span>
                  <span className="text-emerald-400 font-bold text-xl">{stats.active}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-slate-400">تنبيهات أمنية</span>
                  <span className="text-amber-400 font-bold text-xl">{stats.alerts}</span>
                </div>
              </div>
            </div>

            {/* Quick Access Card (Only for Super Admin) */}
            {user?.role === 'superadmin' && (
                <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 p-6 rounded-[2rem] shadow-xl">
                  <h3 className="text-lg font-bold text-white mb-6">إعدادات FYS الأمنية</h3>
                  <div className="grid grid-cols-1 gap-3">
                    <button
                      onClick={() => router.push('/users-admin')}
                      className="flex items-center gap-4 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 hover:border-indigo-500/40 transition-all text-right group"
                    >
                      <div className="p-3 bg-indigo-500/20 rounded-xl">
                        <Users className="w-6 h-6 text-indigo-400" />
                      </div>
                      <div>
                        <p className="font-bold text-white group-hover:text-indigo-300 transition-colors">إدارة المشرفين</p>
                        <p className="text-xs text-slate-400">الصلاحيات والأمان</p>
                      </div>
                    </button>

                    <button 
                      onClick={() => router.push('/system-logs')}
                      className="flex items-center gap-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/40 transition-all text-right group"
                    >
                      <div className="p-3 bg-emerald-500/20 rounded-xl">
                        <Activity className="w-6 h-6 text-emerald-400" />
                      </div>
                      <div>
                        <p className="font-bold text-white group-hover:text-emerald-300 transition-colors">سجل المنظومة</p>
                        <p className="text-xs text-slate-400">مراقبة المشرفين محلياً</p>
                      </div>
                    </button>

                    <button 
                      onClick={() => router.push('/backups')}
                      className="flex items-center gap-4 p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 hover:border-purple-500/40 transition-all text-right group"
                    >
                      <div className="p-3 bg-purple-500/20 rounded-xl">
                        <Database className="w-6 h-6 text-purple-400" />
                      </div>
                      <div>
                        <p className="font-bold text-white group-hover:text-purple-300 transition-colors">النسخ الاحتياطي</p>
                        <p className="text-xs text-slate-400">حماية بيانات النظام</p>
                      </div>
                    </button>

                    <button 
                      onClick={() => router.push('/security-alerts')}
                      className="flex items-center gap-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40 transition-all text-right group"
                    >
                      <div className="p-3 bg-red-500/20 rounded-xl">
                        <ShieldAlert className="w-6 h-6 text-red-400" />
                      </div>
                      <div>
                        <p className="font-bold text-white group-hover:text-red-300 transition-colors">منصة أمن وحماية FYS</p>
                        <p className="text-xs text-slate-400">تتبع المستخدمين، محاولات الاختراق، والحظر</p>
                      </div>
                    </button>

                    <button 
                      onClick={() => router.push('/db-admin')}
                      className="flex items-center gap-4 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 hover:border-blue-500/40 transition-all text-right group"
                    >
                      <div className="p-3 bg-blue-500/20 rounded-xl">
                        <Plus className="w-6 h-6 text-blue-400" />
                      </div>
                      <div>
                        <p className="font-bold text-white group-hover:text-blue-300 transition-colors">إضافة اتصال جديد</p>
                        <p className="text-xs text-slate-400">ربط قاعدة MySQL جديدة بالنظام الأمني</p>
                      </div>
                    </button>

                    <button 
                      onClick={() => router.push('/db-management')}
                      className="flex items-center gap-4 p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20 hover:border-orange-500/40 transition-all text-right group"
                    >
                      <div className="p-3 bg-orange-500/20 rounded-xl">
                        <Trash2 className="w-6 h-6 text-orange-400" />
                      </div>
                      <div>
                        <p className="font-bold text-white group-hover:text-orange-300 transition-colors">إزالة أو إدارة القواعد</p>
                        <p className="text-xs text-slate-400">إدارة الجلسات وحذف سجلات قواعد البيانات</p>
                      </div>
                    </button>

                  </div>
                </div>
            )}

          </div>

          {/* Left Column: Data & Reports */}
          <div className="xl:col-span-3 flex flex-col gap-8">

            {/* Database Security Table */}
            <section className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-white flex items-center gap-3">
                    <Server className="w-7 h-7 text-blue-400" />
                    أمنيات قواعد البيانات
                  </h2>
                  <p className="text-slate-500 text-sm mt-1">مراقبة فورية وتحكم عميق في خوادم البيانات المرتبطة</p>
                </div>
                <button
                  onClick={fetchConnections}
                  className="p-3 hover:bg-white/5 rounded-full transition-colors text-slate-400 hover:text-blue-400"
                >
                  <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead>
                    <tr className="bg-white/5 text-slate-400 text-sm font-bold">
                      <th className="px-8 py-4">الحالة</th>
                      <th className="px-8 py-4">قاعدة البيانات / المضيف</th>
                      <th className="px-8 py-4">آخر ظهور</th>
                      <th className="px-8 py-4 text-center">الوظائف الأمنية</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {displayConnections.map((conn) => (
                      <tr key={conn.id} className="hover:bg-blue-500/[0.02] transition-colors group">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-2">
                            <span className={`w-3 h-3 rounded-full ${conn.status === 'active' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`} />
                            <span className={`text-xs font-bold ${conn.status === 'active' ? 'text-emerald-400' : 'text-red-400'}`}>
                              {conn.status === 'active' ? 'متصل' : 'مفقود'}
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex flex-col">
                            <span className="font-black text-white text-lg group-hover:text-blue-400 transition-colors uppercase">{conn.database_name}</span>
                            <span className="text-xs text-slate-500 font-mono tracking-widest">{conn.username}@{conn.host}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className="text-sm text-slate-400">{new Date(conn.last_seen_at).toLocaleString('ar-SA')}</span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center justify-center gap-2">
                             {/* Check Connection / Ping Icon */}
                            <button
                              onClick={() => handleManualCheck(conn)}
                              title="تنشيط وإعادة فحص الاتصال"
                              disabled={checkingId === conn.id}
                              className={`p-3 rounded-xl transition-all ${checkingId === conn.id ? 'bg-slate-500/10 text-slate-500 cursor-not-allowed' : 'bg-slate-500/10 text-slate-300 hover:bg-slate-500 hover:text-white'}`}
                            >
                              <RefreshCw className={`w-5 h-5 ${checkingId === conn.id ? 'animate-spin' : ''}`} />
                            </button>

                            {/* Activity Log Icon */}
                            <button
                              onClick={() => navigateToFunction('/activity-logs', conn)}
                              title="سجل النشاط"
                              className="p-3 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white rounded-xl transition-all"
                            >
                              <Activity className="w-5 h-5" />
                            </button>
                            {/* Live View Icon */}
                            <button
                              onClick={() => navigateToFunction('/activity-logs/live', conn)}
                              title="مراقبة مباشرة"
                              className="p-3 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-xl transition-all"
                            >
                              <Signal className="w-5 h-5" />
                            </button>
                            {/* Triggers Icon */}
                            <button
                              onClick={() => navigateToFunction('/activity-logs/triggers', conn)}
                              title="إعداد المشغلات"
                              className="p-3 bg-orange-500/10 text-orange-400 hover:bg-orange-500 hover:text-white rounded-xl transition-all"
                            >
                              <Zap className="w-5 h-5" />
                            </button>
                            {/* Users Icon */}
                            <button
                              onClick={() => navigateToFunction('/activity-logs/users', conn)}
                              title="تتبع المستخدمين"
                              className="p-3 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white rounded-xl transition-all"
                            >
                              <UserCheck className="w-5 h-5" />
                            </button>
                            {/* PDF Report Icon */}
                            <button
                              onClick={() => navigateToFunction('/activity-logs/history', conn)}
                              title="تقارير الاتصال (PDF)"
                              className="p-3 bg-slate-500/10 text-slate-400 hover:bg-slate-500 hover:text-white rounded-xl transition-all"
                            >
                              <FileText className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {connections.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-8 py-10 text-center text-slate-500 italic">
                          لا توجد سجلات اتصال حالية. ابدأ بإضافة قاعدة بيانات جديدة.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ===== ANALYTICS SECTION ===== */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

              {/* LEFT: DB Status Distribution — Real data ring chart */}
              <div className="lg:col-span-2 bg-slate-900/60 backdrop-blur-md border border-white/5 p-8 rounded-[2.5rem] shadow-xl flex flex-col">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-3">
                  <BarChart3 className="w-5 h-5 text-blue-500" />
                  توزيع حالة الاتصالات
                </h3>

                {/* Ring chart using SVG */}
                {(() => {
                  const total = displayConnections.length;
                  const active = displayConnections.filter(c => c.status === 'active').length;
                  const disconnected = total - active;
                  const radius = 54;
                  const circumference = 2 * Math.PI * radius;
                  const activePct = total > 0 ? active / total : 0;
                  const dashActive = circumference * activePct;
                  const dashDisc = circumference * (1 - activePct);

                  return (
                    <div className="flex flex-col items-center gap-6 flex-1 justify-center">
                      <div className="relative w-36 h-36">
                        <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90">
                          <circle cx="64" cy="64" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="14" />
                          {total > 0 && (
                            <>
                              <circle
                                cx="64" cy="64" r={radius} fill="none"
                                stroke="#10b981" strokeWidth="14"
                                strokeDasharray={`${dashActive} ${circumference - dashActive}`}
                                strokeLinecap="round"
                                style={{ transition: 'stroke-dasharray 1s ease' }}
                              />
                              {disconnected > 0 && (
                                <circle
                                  cx="64" cy="64" r={radius} fill="none"
                                  stroke="#ef4444" strokeWidth="14"
                                  strokeDasharray={`${dashDisc} ${circumference - dashDisc}`}
                                  strokeDashoffset={-dashActive}
                                  strokeLinecap="round"
                                  style={{ transition: 'all 1s ease' }}
                                />
                              )}
                            </>
                          )}
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-3xl font-black text-white">{total}</span>
                          <span className="text-[10px] text-slate-400 tracking-widest">قاعدة</span>
                        </div>
                      </div>

                      <div className="w-full grid grid-cols-2 gap-3">
                        <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                          <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                          <div>
                            <p className="text-xl font-black text-emerald-400">{active}</p>
                            <p className="text-[10px] text-slate-400">متصل</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-2xl">
                          <div className="w-3 h-3 rounded-full bg-red-500" />
                          <div>
                            <p className="text-xl font-black text-red-400">{disconnected}</p>
                            <p className="text-[10px] text-slate-400">مقطوع</p>
                          </div>
                        </div>
                      </div>

                      {/* Uptime bar */}
                      <div className="w-full">
                        <div className="flex justify-between text-xs text-slate-400 mb-2">
                          <span>معدل الاتصال</span>
                          <span className="text-emerald-400 font-bold">{total > 0 ? Math.round((active / total) * 100) : 0}%</span>
                        </div>
                        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-1000"
                            style={{ width: `${total > 0 ? (active / total) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* RIGHT: Recent Security Events Feed — Real data from system_activity_logs */}
              <div className="lg:col-span-3 bg-slate-900/60 backdrop-blur-md border border-white/5 p-8 rounded-[2.5rem] shadow-xl flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-white flex items-center gap-3">
                    <Activity className="w-5 h-5 text-violet-400" />
                    آخر الأحداث الأمنية
                  </h3>
                  <button
                    onClick={() => router.push('/system-logs')}
                    className="text-xs text-slate-400 hover:text-violet-400 transition-colors font-bold flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-xl"
                  >
                    <ExternalLink className="w-3 h-3" />
                    عرض الكل
                  </button>
                </div>

                <div className="flex-1 flex flex-col gap-2 overflow-hidden">
                  {recentSystemLogs.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-3">
                      <ShieldCheck className="w-10 h-10 opacity-30" />
                      <p className="text-sm">لا توجد أحداث مسجلة بعد</p>
                    </div>
                  ) : (
                    recentSystemLogs.map(log => {
                      const isAlert = ['LOGIN_FAILED','ACCOUNT_LOCKED','DB_HARD_DELETED'].includes(log.action_type);
                      const isSuccess = ['LOGIN_SUCCESS','DB_CONNECTED','USER_CREATED','USER_UNLOCKED','BACKUP_CREATED'].includes(log.action_type);
                      const dotColor = isAlert ? 'bg-red-500' : isSuccess ? 'bg-emerald-500' : 'bg-blue-500';
                      const eventLabels: Record<string,string> = {
                        'LOGIN_SUCCESS': 'دخول ناجح', 'LOGIN_FAILED': 'محاولة دخول فاشلة',
                        'LOGOUT': 'خروج', 'ACCOUNT_LOCKED': 'حساب محظور',
                        'DB_CONNECTED': 'إضافة قاعدة', 'DB_DISCONNECTED': 'إزالة اتصال',
                        'DB_HARD_DELETED': 'حذف جذري', 'USER_CREATED': 'مستخدم جديد',
                        'USER_UPDATED': 'تعديل مستخدم', 'USER_DELETED': 'حذف مستخدم',
                        'USER_UNLOCKED': 'فك حظر', 'TRIGGER_ADDED': 'تفعيل Trigger',
                        'TRIGGER_REMOVED': 'إيقاف Trigger', 'MONITORING_SETUP': 'تهيئة مراقبة',
                        'DB_PERMISSIONS_UPDATED': 'تعديل صلاحيات', 'BACKUP_CREATED': 'نسخة احتياطية',
                      };
                      return (
                        <div key={log.id} className="flex items-start gap-3 p-3 bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 rounded-2xl transition-colors">
                          <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${dotColor} ${isAlert ? 'shadow-[0_0_6px_rgba(239,68,68,0.6)]' : ''}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-200 truncate">
                                {eventLabels[log.action_type] || log.action_type}
                              </span>
                              <span className="text-[10px] text-slate-600 font-mono shrink-0">
                                {new Date(log.created_at).toLocaleTimeString('ar-SA', {hour:'2-digit', minute:'2-digit'})}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              <span className="text-slate-400 font-bold">{log.username}</span> — {log.details}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>

            {/* Monitor: focused DB health panel */}
            {user?.role === 'monitor' && user?.assigned_db && (() => {
              const assignedConns = connections.filter(c => c.database_name === user.assigned_db);
              const conn = assignedConns[0];
              const isActive = conn?.status === 'active';
              const lastSeen = conn ? new Date(conn.last_seen_at) : null;
              const minutesAgo = lastSeen ? Math.round((Date.now() - lastSeen.getTime()) / 60000) : null;
              return (
                <div className="bg-slate-900/60 backdrop-blur-md border border-indigo-500/20 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
                  <div className="flex items-center justify-between mb-8 relative z-10">
                    <h3 className="text-lg font-bold text-white flex items-center gap-3">
                      <Signal className="w-5 h-5 text-indigo-400" />
                      لوحة صحة قاعدة البيانات — <span className="text-indigo-400">{user.assigned_db}</span>
                    </h3>
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold ${
                      isActive ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                      {isActive ? 'الاتصال نشط' : 'الاتصال منقطع'}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
                    {[
                      { label: 'حالة الاتصال', value: isActive ? 'متصل' : 'منقطع', color: isActive ? 'text-emerald-400' : 'text-red-400', icon: <Signal className="w-5 h-5" /> },
                      { label: 'الخادم', value: conn?.host || '—', color: 'text-slate-200', icon: <Server className="w-5 h-5" /> },
                      { label: 'مستخدم DB', value: conn?.username || '—', color: 'text-blue-400', icon: <UserCheck className="w-5 h-5" /> },
                      { label: 'آخر ظهور', value: minutesAgo !== null ? (minutesAgo < 1 ? 'الآن' : `${minutesAgo} دقيقة`) : '—', color: minutesAgo !== null && minutesAgo < 5 ? 'text-emerald-400' : 'text-amber-400', icon: <History className="w-5 h-5" /> },
                    ].map((item, i) => (
                      <div key={i} className="bg-black/30 border border-white/5 rounded-2xl p-5 flex flex-col gap-3">
                        <div className="text-slate-500">{item.icon}</div>
                        <p className={`text-xl font-black ${item.color} truncate`}>{item.value}</p>
                        <p className="text-[11px] text-slate-500">{item.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 relative z-10 flex items-center gap-4">
                    <button
                      onClick={() => conn && navigateToFunction('/activity-logs', conn)}
                      disabled={!conn}
                      className="flex-1 py-3 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 font-bold rounded-2xl text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                    >
                      <Activity className="w-4 h-4" />
                      سجل النشاط
                    </button>
                    <button
                      onClick={() => conn && navigateToFunction('/activity-logs/live', conn)}
                      disabled={!conn || !isActive}
                      className="flex-1 py-3 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 font-bold rounded-2xl text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                    >
                      <Signal className="w-4 h-4" />
                      مراقبة مباشرة
                    </button>
                    <button
                      onClick={() => conn && handleManualCheck(conn)}
                      disabled={!conn || checkingId === conn?.id}
                      className="py-3 px-5 bg-slate-700/40 hover:bg-slate-700 border border-white/5 text-slate-300 font-bold rounded-2xl text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                    >
                      <RefreshCw className={`w-4 h-4 ${checkingId === conn?.id ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>
              );
            })()}

          </div>

        </div>

        {/* System Logs / Terminal Feed */}
        <footer className="mt-8 bg-black/40 border border-white/5 rounded-[2rem] p-6 backdrop-blur-md">
          <div className="flex items-center justify-between mb-4 px-2">
            <div className="flex items-center gap-3">
              <Terminal className="w-5 h-5 text-slate-500" />
              <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">System Security Feed Cache</span>
            </div>
            <span className="text-xs text-slate-600 font-mono">Last Update: {new Date().toLocaleTimeString()}</span>
          </div>
          <div className="bg-black/50 p-4 rounded-xl border border-white/5 font-mono text-xs text-emerald-500/80 leading-loose">
            <div>[SYSTEM] Secure portal verified for {user?.username}.</div>
            {user?.role === 'monitor' ? (
                <div>[MONITOR] Active listener engaged specifically for {user?.assigned_db}.</div>
            ) : (
                <div>[SYSTEM] Local storage sync complete. {displayConnections.length} nodes cached.</div>
            )}
            <div className="animate-pulse">[LISTENING] Monitoring heartbeat...</div>
          </div>
        </footer>

      </div>
    </div>
  );
}

