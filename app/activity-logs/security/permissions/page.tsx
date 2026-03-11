'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    KeyRound, Users, Server, Eye, Plus, Trash2, Lock, Unlock,
    Loader2, ShieldCheck, CheckCircle2, XCircle, RefreshCw, UserCheck
} from 'lucide-react';

type DbUser = { username: string; host: string };
type Permissions = { select: boolean; insert: boolean; update: boolean; delete: boolean };

const PERMS_CONFIG = [
    { key: 'select' as keyof Permissions, label: 'SELECT', desc: 'قراءة البيانات', icon: Eye, color: 'blue' },
    { key: 'insert' as keyof Permissions, label: 'INSERT', desc: 'إضافة بيانات', icon: Plus, color: 'emerald' },
    { key: 'update' as keyof Permissions, label: 'UPDATE', desc: 'تعديل البيانات', icon: CheckCircle2, color: 'amber' },
    { key: 'delete' as keyof Permissions, label: 'DELETE', desc: 'حذف البيانات', icon: Trash2, color: 'red' },
];

const permColorMap: Record<string, { card: string; icon: string }> = {
    blue: { card: 'border-blue-500 bg-blue-500/10', icon: 'text-blue-400' },
    emerald: { card: 'border-emerald-500 bg-emerald-500/10', icon: 'text-emerald-400' },
    amber: { card: 'border-amber-500 bg-amber-500/10', icon: 'text-amber-400' },
    red: { card: 'border-red-500 bg-red-500/10', icon: 'text-red-400' },
};

export default function PermissionsPage() {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState<DbUser[]>([]);
    const [tables, setTables] = useState<string[]>([]);
    const [selectedUser, setSelectedUser] = useState<DbUser | null>(null);
    const [selectedTable, setSelectedTable] = useState('');
    const [permissions, setPermissions] = useState<Permissions>({ select: false, insert: false, update: false, delete: false });
    const [permsLoading, setPermsLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        const sid = localStorage.getItem('dbConnectionSession');
        setSessionId(sid);
        if (sid) fetchMeta(sid);
    }, []);

    const fetchMeta = useCallback(async (sid: string) => {
        setLoading(true);
        try {
            const res = await fetch('/api/db', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_tables', sessionId: sid }),
            });
            const data = await res.json();
            if (data.success) {
                setUsers(data.users || []);
                setTables((data.tables || []).filter((t: string) => !t.startsWith('_system')));
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, []);

    const fetchPermissions = async (user: DbUser, table: string) => {
        if (!sessionId || !user || !table) return;
        setPermsLoading(true);
        try {
            const res = await fetch('/api/db', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_permissions', sessionId, targetUser: user.username, targetHost: user.host, targetTable: table }),
            });
            const data = await res.json();
            if (data.success) setPermissions(data.permissions);
        } catch (e) { console.error(e); }
        finally { setPermsLoading(false); }
    };

    const handleSave = async () => {
        if (!sessionId || !selectedUser || !selectedTable) return;
        setSaving(true); setMessage({ type: '', text: '' });
        try {
            const res = await fetch('/api/db', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update_permissions', sessionId, targetUser: selectedUser.username, targetHost: selectedUser.host, targetTable: selectedTable, permissions }),
            });
            const data = await res.json();
            setMessage({ type: data.success ? 'success' : 'error', text: data.message });
        } catch { setMessage({ type: 'error', text: 'فشل الاتصال' }); }
        finally { setSaving(false); }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ── Left Column: Pickers ── */}
            <div className="lg:col-span-1 flex flex-col gap-4">
                {/* Users */}
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-white text-sm flex items-center gap-2">
                            <Users className="w-4 h-4 text-indigo-400" /> مستخدمو MySQL
                        </h3>
                        {sessionId && (
                            <button onClick={() => fetchMeta(sessionId)} className="text-slate-500 hover:text-white transition-colors">
                                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        )}
                    </div>
                    {loading ? (
                        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-indigo-400" /></div>
                    ) : (
                        <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
                            {users.length === 0 && <p className="text-slate-600 text-xs text-center py-4">لا يوجد مستخدمون</p>}
                            {users.map((u, i) => {
                                const active = selectedUser?.username === u.username && selectedUser?.host === u.host;
                                return (
                                    <button key={i} onClick={() => { setSelectedUser(u); if (selectedTable) fetchPermissions(u, selectedTable); }}
                                        className={`flex items-center gap-3 p-3 rounded-xl border text-right transition-all ${active ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900/50 border-slate-700/50 text-slate-300 hover:border-indigo-500/30'}`}>
                                        <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
                                            <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                                        </div>
                                        <div className="min-w-0 text-right">
                                            <p className="font-bold text-xs truncate">{u.username}</p>
                                            <p className="text-[10px] opacity-50 font-mono">@{u.host}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Tables */}
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
                    <h3 className="font-bold text-white text-sm flex items-center gap-2 mb-4">
                        <Server className="w-4 h-4 text-blue-400" /> الجداول
                    </h3>
                    <div className="flex flex-col gap-2 max-h-52 overflow-y-auto">
                        {tables.map((t, i) => (
                            <button key={i} onClick={() => { setSelectedTable(t); if (selectedUser) fetchPermissions(selectedUser, t); }}
                                className={`p-2.5 rounded-xl border text-right text-xs font-bold transition-all ${selectedTable === t ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900/50 border-slate-700/50 text-slate-400 hover:border-blue-500/30'}`}>
                                {t}
                            </button>
                        ))}
                        {tables.length === 0 && !loading && <p className="text-slate-600 text-xs text-center py-4">لا توجد جداول</p>}
                    </div>
                </div>
            </div>

            {/* ── Right Column: Permissions Panel ── */}
            <div className="lg:col-span-2 bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 flex flex-col gap-6">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-white text-base flex items-center gap-2">
                            <KeyRound className="w-5 h-5 text-indigo-400" />
                            {selectedUser && selectedTable
                                ? <>صلاحيات <span className="text-indigo-400">{selectedUser.username}</span> على <span className="text-blue-400">{selectedTable}</span></>
                                : 'لوحة الصلاحيات'}
                        </h3>
                        {selectedUser && <p className="text-xs text-slate-500 mt-1 font-mono">Host: {selectedUser.host}</p>}
                    </div>
                    {permsLoading && <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />}
                </div>

                {!selectedUser || !selectedTable ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-24 text-slate-600">
                        <KeyRound className="w-16 h-16 opacity-10 mb-4" />
                        <p className="text-sm">اختر مستخدماً وجدولاً لعرض الصلاحيات وتعديلها</p>
                    </div>
                ) : (
                    <>
                        {/* Permissions Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            {PERMS_CONFIG.map(perm => {
                                const Icon = perm.icon;
                                const isGranted = permissions[perm.key];
                                const { card, icon } = permColorMap[perm.color];
                                return (
                                    <button key={perm.key} onClick={() => setPermissions(p => ({ ...p, [perm.key]: !p[perm.key] }))}
                                        className={`p-5 rounded-xl border-2 transition-all duration-300 text-right flex items-start gap-4 ${isGranted ? card : 'border-slate-700/50 bg-slate-900/40 hover:border-slate-600'}`}>
                                        <div className={`mt-0.5 transition-all ${isGranted ? icon : 'text-slate-600'}`}>
                                            {isGranted ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                                        </div>
                                        <div className="flex-1">
                                            <p className={`font-black font-mono text-sm ${isGranted ? 'text-white' : 'text-slate-500'}`}>{perm.label}</p>
                                            <p className="text-[11px] text-slate-500 mt-0.5">{perm.desc}</p>
                                        </div>
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${isGranted ? `border-current bg-current ${icon}` : 'border-slate-600'}`}>
                                            {isGranted && <CheckCircle2 className="w-3 h-3 text-white" />}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Message */}
                        {message.text && (
                            <div className={`p-3 rounded-xl border text-sm flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                                {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
                                {message.text}
                            </div>
                        )}

                        {/* Save Button */}
                        <button onClick={handleSave} disabled={saving}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] disabled:opacity-50">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                            {saving ? 'جاري الحفظ...' : 'حفظ الصلاحيات'}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
