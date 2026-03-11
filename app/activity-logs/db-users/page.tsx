'use client';

import { useState, useEffect } from 'react';
import { Users, ShieldCheck, Key, Plus, Trash2, Edit2, Loader2, Database, ShieldAlert, Monitor, Server, X } from 'lucide-react';

interface DBUser {
    username: string;
    host: string;
}

export default function DBUsersManagementPage() {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [dbUsers, setDbUsers] = useState<DBUser[]>([]);
    const [tables, setTables] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState<DBUser | null>(null);
    const [showPermissionsModal, setShowPermissionsModal] = useState<DBUser | null>(null);

    // Form States
    const [newUser, setNewUser] = useState({ username: '', host: '%', password: '' });
    const [newPassword, setNewPassword] = useState('');
    const [selectedTable, setSelectedTable] = useState('');
    const [permissions, setPermissions] = useState({ select: false, insert: false, update: false, delete: false });

    useEffect(() => {
        const sid = localStorage.getItem('dbConnectionSession');
        setSessionId(sid);
        if (sid) {
            fetchData(sid);
        }
    }, []);

    const fetchData = async (sid: string) => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_tables', sessionId: sid }),
            });
            const data = await res.json();
            if (data.success) {
                setTables(data.tables || []);
                setDbUsers(data.users || []);
            }
        } catch (err) {
            console.error('Failed to fetch DB data');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateUser = async () => {
        if (!newUser.username || !newUser.password) return;
        setIsActionLoading(true);
        try {
            const res = await fetch('/api/db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create_db_user',
                    sessionId,
                    targetUser: newUser.username,
                    targetHost: newUser.host,
                    targetPassword: newUser.password
                }),
            });
            const data = await res.json();
            if (data.success) {
                setMessage({ type: 'success', text: data.message });
                setShowCreateModal(false);
                setNewUser({ username: '', host: '%', password: '' });
                fetchData(sessionId as string);
            } else {
                setMessage({ type: 'error', text: data.message });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'فشل إنشاء المستخدم.' });
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleDeleteUser = async (user: DBUser) => {
        if (!confirm(`هل أنت متأكد من حذف مستخدم قاعدة البيانات "${user.username}@${user.host}"؟`)) return;
        setIsActionLoading(true);
        try {
            const res = await fetch('/api/db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'drop_db_user',
                    sessionId,
                    targetUser: user.username,
                    targetHost: user.host
                }),
            });
            const data = await res.json();
            if (data.success) {
                setMessage({ type: 'success', text: data.message });
                fetchData(sessionId as string);
            } else {
                setMessage({ type: 'error', text: data.message });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'فشل حذف المستخدم.' });
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleChangePassword = async () => {
        if (!showPasswordModal || !newPassword) return;
        setIsActionLoading(true);
        try {
            const res = await fetch('/api/db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'change_db_user_password',
                    sessionId,
                    targetUser: showPasswordModal.username,
                    targetHost: showPasswordModal.host,
                    newPassword
                }),
            });
            const data = await res.json();
            if (data.success) {
                setMessage({ type: 'success', text: data.message });
                setShowPasswordModal(null);
                setNewPassword('');
            } else {
                setMessage({ type: 'error', text: data.message });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'فشل تغيير كلمة المرور.' });
        } finally {
            setIsActionLoading(false);
        }
    };

    const fetchUserPermissions = async (user: DBUser, table: string) => {
        try {
            const res = await fetch('/api/db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'get_permissions',
                    sessionId,
                    targetUser: user.username,
                    targetHost: user.host,
                    targetTable: table
                }),
            });
            const data = await res.json();
            if (data.success) {
                setPermissions(data.permissions);
            }
        } catch (err) {
            console.error('Failed to fetch permissions');
        }
    };

    const handleUpdatePermissions = async () => {
        if (!showPermissionsModal || !selectedTable) return;
        setIsActionLoading(true);
        try {
            const res = await fetch('/api/db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_permissions',
                    sessionId,
                    targetUser: showPermissionsModal.username,
                    targetHost: showPermissionsModal.host,
                    targetTable: selectedTable,
                    permissions
                }),
            });
            const data = await res.json();
            if (data.success) {
                setMessage({ type: 'success', text: data.message });
                setShowPermissionsModal(null);
                setSelectedTable('');
            } else {
                setMessage({ type: 'error', text: data.message });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'فشل تحديث الصلاحيات.' });
        } finally {
            setIsActionLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
                <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-4" />
                <p className="text-slate-400 animate-pulse">جاري جلب قائمة المستخدمين من الخادم...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-800/40 border border-slate-700/50 p-6 rounded-2xl">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Users className="w-7 h-7 text-indigo-400" /> إدارة مستخدمي الـ MySQL الفعليين
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">عرض وتعديل حسابات المستخدمين المباشرة (root وقواعد البيانات المتصلة) وصلاحياتهم الفنية.</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-indigo-900/30 active:scale-95"
                >
                    <Plus className="w-5 h-5" /> إنشاء مستخدم جديد
                </button>
            </div>

            {/* Notification Message */}
            {message && (
                <div className={`p-4 rounded-xl border flex items-center justify-between ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                    <div className="flex items-center gap-3">
                        <ShieldCheck className="w-5 h-5" />
                        <span className="text-sm font-bold">{message.text}</span>
                    </div>
                    <button onClick={() => setMessage(null)} className="hover:opacity-70"><X className="w-4 h-4" /></button>
                </div>
            )}

            {/* Users Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {dbUsers.map((user, i) => (
                    <div key={i} className="group bg-slate-800/40 hover:bg-slate-800/60 border border-slate-700/50 hover:border-indigo-500/30 p-6 rounded-3xl transition-all shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-indigo-500/10 transition-colors" />
                        
                        <div className="flex items-start justify-between mb-6 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-slate-900/80 rounded-2xl flex items-center justify-center border border-slate-700 shadow-inner">
                                    <Monitor className="w-6 h-6 text-indigo-400" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-lg font-black text-white truncate max-w-[150px]">{user.username}</span>
                                    <span className="text-xs text-slate-500 font-mono tracking-tighter">@{user.host}</span>
                                </div>
                            </div>
                            <div className="p-2 bg-slate-900/50 rounded-lg text-slate-500 border border-slate-800">
                                <Server className="w-4 h-4" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 relative z-10">
                            <button
                                onClick={() => { setShowPermissionsModal(user); setSelectedTable(''); setPermissions({ select: false, insert: false, update: false, delete: false }); }}
                                className="flex items-center justify-center gap-2 py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-bold rounded-xl border border-indigo-500/20 transition-all active:scale-95"
                            >
                                <ShieldCheck className="w-4 h-4" /> الصلاحيات
                            </button>
                            <button
                                onClick={() => { setShowPasswordModal(user); setNewPassword(''); }}
                                className="flex items-center justify-center gap-2 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-xs font-bold rounded-xl border border-amber-500/20 transition-all active:scale-95"
                            >
                                <Key className="w-4 h-4" /> كلمة السر
                            </button>
                            {user.username !== 'root' && (
                                <button
                                    onClick={() => handleDeleteUser(user)}
                                    className="col-span-2 flex items-center justify-center gap-2 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-bold rounded-xl border border-red-500/20 transition-all active:scale-95"
                                >
                                    <Trash2 className="w-4 h-4" /> حذف المستخدم النهائياً
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Create User Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in zoom-in duration-300">
                    <div className="bg-[#111827] border border-slate-700 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl shadow-indigo-500/10 flex flex-col">
                        <div className="p-6 bg-indigo-600 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Plus className="w-6 h-6 text-white" />
                                <h3 className="text-xl font-bold text-white">إنشاء مستخدم DB جديد</h3>
                            </div>
                            <button onClick={() => setShowCreateModal(false)} className="text-white/60 hover:text-white transition"><X /></button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 px-1 uppercase tracking-wider">اسم المستخدم</label>
                                <input
                                    type="text"
                                    value={newUser.username}
                                    onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-white outline-none focus:border-indigo-500 transition-all"
                                    placeholder="e.g. app_user"
                                    dir="ltr"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 px-1 uppercase tracking-wider">المضيف (Host)</label>
                                <input
                                    type="text"
                                    value={newUser.host}
                                    onChange={(e) => setNewUser({...newUser, host: e.target.value})}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-white outline-none focus:border-indigo-500 transition-all font-mono"
                                    placeholder="localhost or %"
                                    dir="ltr"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 px-1 uppercase tracking-wider">كلمة المرور</label>
                                <input
                                    type="password"
                                    value={newUser.password}
                                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-white outline-none focus:border-indigo-500 transition-all font-mono"
                                    placeholder="••••••••"
                                    dir="ltr"
                                />
                            </div>
                            <button
                                onClick={handleCreateUser}
                                disabled={isActionLoading || !newUser.username || !newUser.password}
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black transition-all flex items-center justify-center gap-3 disabled:opacity-40"
                            >
                                {isActionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                                تنفيذ الأمر الفني
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Change Password Modal */}
            {showPasswordModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in zoom-in duration-300">
                    <div className="bg-[#111827] border border-slate-700 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col font-sans" dir="rtl">
                        <div className="p-6 bg-amber-600 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Key className="w-6 h-6 text-white" />
                                <h3 className="text-xl font-bold text-white">تغيير كلمة المرور</h3>
                            </div>
                            <button onClick={() => setShowPasswordModal(null)} className="text-white/60 hover:text-white transition"><X /></button>
                        </div>
                        <div className="p-8">
                            <p className="text-slate-400 text-sm mb-6">أنت بصدد تغيير كلمة مرور المستخدم: <span className="text-amber-500 font-bold font-mono">{showPasswordModal.username}@{showPasswordModal.host}</span></p>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 px-1 uppercase tracking-wider">كلمة المرور الجديدة</label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-white outline-none focus:border-amber-500 transition-all font-mono"
                                        placeholder="••••••••"
                                        dir="ltr"
                                    />
                                </div>
                                <button
                                    onClick={handleChangePassword}
                                    disabled={isActionLoading || !newPassword}
                                    className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl font-black transition-all flex items-center justify-center gap-3 disabled:opacity-40 shadow-lg shadow-amber-900/30"
                                >
                                    {isActionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                                    تحديث كلمة المرور آلان
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Permissions Modal */}
            {showPermissionsModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in zoom-in duration-300">
                    <div className="bg-[#111827] border border-slate-700 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col font-sans" dir="rtl">
                        <div className="p-6 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3 text-indigo-400">
                                <ShieldCheck className="w-6 h-6" />
                                <h3 className="text-xl font-bold">تعديل صلاحيات الجدول الفنية</h3>
                            </div>
                            <button onClick={() => setShowPermissionsModal(null)} className="text-slate-500 hover:text-white transition"><X /></button>
                        </div>
                        <div className="p-8">
                            <div className="mb-8 p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/20">
                                <p className="text-indigo-300 text-xs font-bold mb-1 uppercase tracking-widest">المستخدم المستهدف</p>
                                <p className="text-white font-black font-mono">{showPermissionsModal.username}@{showPermissionsModal.host}</p>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 px-1 uppercase tracking-wider">اختر الجدول لتعديل صلاحياته</label>
                                    <select
                                        value={selectedTable}
                                        onChange={(e) => { setSelectedTable(e.target.value); if (e.target.value) fetchUserPermissions(showPermissionsModal, e.target.value); }}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-white outline-none focus:border-indigo-500 transition-all font-mono appearance-none"
                                        dir="ltr"
                                    >
                                        <option value="">-- اختر جدولاً من القائمة --</option>
                                        {tables.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>

                                {selectedTable && (
                                    <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
                                        {[
                                            { id: 'select', label: 'SELECT', desc: 'قراءة البيانات' },
                                            { id: 'insert', label: 'INSERT', desc: 'إضافة بيانات' },
                                            { id: 'update', label: 'UPDATE', desc: 'تحديث بيانات' },
                                            { id: 'delete', label: 'DELETE', desc: 'حذف بيانات' }
                                        ].map(perm => (
                                            <button
                                                key={perm.id}
                                                onClick={() => setPermissions({ ...permissions, [perm.id]: !permissions[perm.id as keyof typeof permissions] })}
                                                className={`flex flex-col items-center p-4 rounded-2xl border transition-all ${permissions[perm.id as keyof typeof permissions] ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/40' : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                                            >
                                                <span className="font-bold mb-1 tracking-widest">{perm.label}</span>
                                                <span className="text-[10px] opacity-70">{perm.desc}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <button
                                    onClick={handleUpdatePermissions}
                                    disabled={isActionLoading || !selectedTable}
                                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black transition-all flex items-center justify-center gap-3 disabled:opacity-40 mt-4"
                                >
                                    {isActionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                                    تحديث المصفوفة الأمنية
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
