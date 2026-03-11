'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Users, Plus, Trash2, KeyRound, Eye, EyeOff, RefreshCw,
    Loader2, CheckCircle2, XCircle, UserCheck, UserX
} from 'lucide-react';

type DbUser = { username: string; host: string };

export default function UsersPage() {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [users, setUsers] = useState<DbUser[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState('');
    const [message, setMessage] = useState({ type: '', text: '' });
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [changingPassFor, setChangingPassFor] = useState<DbUser | null>(null);
    const [newPass, setNewPass] = useState('');
    const [showNewPass, setShowNewPass] = useState(false);
    const [form, setForm] = useState({ username: '', host: '%', password: '' });
    const [showFormPass, setShowFormPass] = useState(false);

    useEffect(() => {
        const sid = localStorage.getItem('dbConnectionSession');
        setSessionId(sid);
        if (sid) fetchUsers(sid);
    }, []);

    const fetchUsers = useCallback(async (sid: string) => {
        setLoading(true);
        try {
            const res = await fetch('/api/db', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_tables', sessionId: sid }),
            });
            const data = await res.json();
            if (data.success) setUsers(data.users || []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, []);

    const showMsg = (type: string, text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    };

    const handleCreate = async () => {
        if (!sessionId || !form.username || !form.password) return showMsg('error', 'يجب ملء جميع الحقول');
        setActionLoading('create');
        try {
            const res = await fetch('/api/db', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'create_db_user', sessionId, targetUser: form.username, targetHost: form.host, targetPassword: form.password }),
            });
            const data = await res.json();
            showMsg(data.success ? 'success' : 'error', data.message);
            if (data.success) {
                setShowCreateForm(false);
                setForm({ username: '', host: '%', password: '' });
                fetchUsers(sessionId);
            }
        } catch { showMsg('error', 'فشل الاتصال'); }
        finally { setActionLoading(''); }
    };

    const handleDelete = async (user: DbUser) => {
        if (!sessionId || !confirm(`هل أنت متأكد من حذف "${user.username}"؟`)) return;
        setActionLoading(`delete-${user.username}`);
        try {
            const res = await fetch('/api/db', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'drop_db_user', sessionId, targetUser: user.username, targetHost: user.host }),
            });
            const data = await res.json();
            showMsg(data.success ? 'success' : 'error', data.message);
            if (data.success) fetchUsers(sessionId);
        } catch { showMsg('error', 'فشل الاتصال'); }
        finally { setActionLoading(''); }
    };

    const handleChangePass = async () => {
        if (!sessionId || !changingPassFor || !newPass) return;
        setActionLoading('changepass');
        try {
            const res = await fetch('/api/db', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'change_db_user_password', sessionId, targetUser: changingPassFor.username, targetHost: changingPassFor.host, newPassword: newPass }),
            });
            const data = await res.json();
            showMsg(data.success ? 'success' : 'error', data.message);
            if (data.success) { setChangingPassFor(null); setNewPass(''); }
        } catch { showMsg('error', 'فشل الاتصال'); }
        finally { setActionLoading(''); }
    };

    return (
        <div className="flex flex-col gap-5">

            {/* ── Toolbar ── */}
            <div className="flex items-center justify-between">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-400" />
                    مستخدمو قاعدة البيانات
                    <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{users.length}</span>
                </h3>
                <div className="flex gap-2">
                    <button onClick={() => sessionId && fetchUsers(sessionId)}
                        className="p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 transition-all">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button onClick={() => setShowCreateForm(!showCreateForm)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                        <Plus className="w-4 h-4" /> إنشاء مستخدم
                    </button>
                </div>
            </div>

            {/* ── Global Message ── */}
            {message.text && (
                <div className={`p-3 rounded-xl border text-sm flex items-center gap-2 animate-in fade-in duration-300 ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                    {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
                    {message.text}
                </div>
            )}

            {/* ── Create Form ── */}
            {showCreateForm && (
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-2xl p-6 flex flex-col gap-4 animate-in slide-in-from-top-4 duration-300">
                    <h4 className="font-bold text-blue-300 flex items-center gap-2 text-sm">
                        <Plus className="w-4 h-4" /> إنشاء مستخدم MySQL جديد
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                            { label: 'اسم المستخدم', field: 'username', placeholder: 'myuser', type: 'text', showToggle: false },
                            { label: 'Host', field: 'host', placeholder: '%', type: 'text', showToggle: false },
                        ].map(({ label, field, placeholder, type }) => (
                            <div key={field} className="flex flex-col gap-1.5">
                                <label className="text-xs text-slate-400 font-semibold">{label}</label>
                                <input type={type} value={form[field as keyof typeof form]}
                                    onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                                    placeholder={placeholder} dir="ltr"
                                    className="bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500 transition-colors" />
                            </div>
                        ))}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs text-slate-400 font-semibold">كلمة المرور</label>
                            <div className="relative">
                                <input type={showFormPass ? 'text' : 'password'} value={form.password}
                                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                                    placeholder="••••••••" dir="ltr"
                                    className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500 transition-colors pr-10" />
                                <button onClick={() => setShowFormPass(!showFormPass)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                                    {showFormPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3 justify-end">
                        <button onClick={() => setShowCreateForm(false)}
                            className="px-4 py-2 bg-slate-800 border border-slate-700 text-slate-400 rounded-xl text-sm hover:bg-slate-700 transition-all">
                            إلغاء
                        </button>
                        <button onClick={handleCreate} disabled={actionLoading === 'create'}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-all disabled:opacity-50">
                            {actionLoading === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} إنشاء
                        </button>
                    </div>
                </div>
            )}

            {/* ── Change Password Inline ── */}
            {changingPassFor && (
                <div className="bg-amber-900/20 border border-amber-500/30 rounded-2xl p-5 flex flex-col gap-4 animate-in slide-in-from-top-4 duration-300">
                    <h4 className="font-bold text-amber-300 flex items-center gap-2 text-sm">
                        <KeyRound className="w-4 h-4" />
                        تغيير كلمة مرور: <span className="font-mono text-white">{changingPassFor.username}@{changingPassFor.host}</span>
                    </h4>
                    <div className="flex gap-3">
                        <div className="relative flex-1">
                            <input type={showNewPass ? 'text' : 'password'} value={newPass}
                                onChange={e => setNewPass(e.target.value)}
                                placeholder="كلمة المرور الجديدة" dir="ltr"
                                className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-amber-500 transition-colors pr-10" />
                            <button onClick={() => setShowNewPass(!showNewPass)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                                {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        <button onClick={() => { setChangingPassFor(null); setNewPass(''); }}
                            className="px-4 py-2 bg-slate-800 border border-slate-700 text-slate-400 rounded-xl text-sm hover:bg-slate-700 transition-all">
                            إلغاء
                        </button>
                        <button onClick={handleChangePass} disabled={actionLoading === 'changepass'}
                            className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-all disabled:opacity-50">
                            {actionLoading === 'changepass' ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} حفظ
                        </button>
                    </div>
                </div>
            )}

            {/* ── Users Grid ── */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-7 h-7 animate-spin text-blue-400" />
                </div>
            ) : users.length === 0 ? (
                <div className="text-center py-20 text-slate-500 bg-slate-800/30 border border-slate-700/40 rounded-2xl">
                    <UserX className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">لا يوجد مستخدمون</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {users.map((user, i) => (
                        <div key={i} className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 group hover:border-blue-500/30 transition-all duration-300">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="w-11 h-11 bg-blue-500/20 rounded-xl flex items-center justify-center border border-blue-500/30 shrink-0 group-hover:bg-blue-500/30 transition-colors">
                                    <UserCheck className="w-5 h-5 text-blue-400" />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-bold text-white truncate">{user.username}</p>
                                    <p className="text-[11px] text-slate-500 font-mono">@{user.host}</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setChangingPassFor(user)}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-xl text-xs font-bold transition-all">
                                    <KeyRound className="w-3.5 h-3.5" /> تغيير كلمة المرور
                                </button>
                                <button onClick={() => handleDelete(user)} disabled={!!actionLoading}
                                    className="py-2 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs transition-all disabled:opacity-40">
                                    {actionLoading === `delete-${user.username}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
