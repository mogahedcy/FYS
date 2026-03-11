'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Database, LogOut, CheckSquare, Square, Save, Loader2, User, Table as TableIcon, ShieldAlert, CheckCircle2, UserPlus, Key, Trash2, X } from 'lucide-react';

export default function DbExplorerPage() {
    const router = useRouter();
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [dbName, setDbName] = useState<string | null>(null);

    const [tables, setTables] = useState<string[]>([]);
    const [users, setUsers] = useState<{ username: string, host: string }[]>([]);

    const [selectedTable, setSelectedTable] = useState<string | null>(null);
    const [selectedUser, setSelectedUser] = useState<{ username: string, host: string } | null>(null);

    const [permissions, setPermissions] = useState({ select: false, insert: false, update: false, delete: false });

    // Modals & Action States
    const [showUserModal, setShowUserModal] = useState<'create' | 'edit_pass' | null>(null);
    const [userFormData, setUserFormData] = useState({ host: '%', username: '', password: '' });
    const [isActionLoading, setIsActionLoading] = useState(false);

    // Status
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isFetchingPermissions, setIsFetchingPermissions] = useState(false);

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

        fetchData(storedSessionId);
    }, [router]);

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
                setUsers(data.users || []);
            } else {
                setMessage({ type: 'error', text: data.message || 'فشل في جلب البيانات' });
                if (data.message && data.message.includes('الجلسة')) {
                    setTimeout(() => router.push('/db-admin'), 2000);
                }
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'حدث خطأ غير متوقع في الاتصال.' });
        } finally {
            setIsLoading(false);
        }
    };

    const fetchPermissions = async (user: { username: string, host: string }, table: string) => {
        setIsFetchingPermissions(true);
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
                setMessage({ type: '', text: '' });
            } else {
                setMessage({ type: 'error', text: data.message || 'فشل في جلب الصلاحيات' });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'حدث خطأ أثناء جلب الصلاحيات.' });
        } finally {
            setIsFetchingPermissions(false);
        }
    };

    const handleSelectUser = (user: { username: string, host: string }) => {
        setSelectedUser(user);
        if (selectedTable) {
            fetchPermissions(user, selectedTable);
        }
    };

    const handleSelectTable = (table: string) => {
        setSelectedTable(table);
        if (selectedUser) {
            fetchPermissions(selectedUser, table);
        }
    };

    const handleTogglePermission = (key: keyof typeof permissions) => {
        setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSavePermissions = async () => {
        if (!selectedUser || !selectedTable || !sessionId) return;

        setIsSaving(true);
        setMessage({ type: '', text: '' });

        try {
            const res = await fetch('/api/db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_permissions',
                    sessionId,
                    targetUser: selectedUser.username,
                    targetHost: selectedUser.host,
                    targetTable: selectedTable,
                    permissions
                }),
            });
            const data = await res.json();
            if (data.success) {
                setMessage({ type: 'success', text: 'تم تحديث الصلاحيات بنجاح!' });
            } else {
                setMessage({ type: 'error', text: data.message || 'فشل في تحديث الصلاحيات' });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'حدث خطأ أثناء حفظ الصلاحيات.' });
        } finally {
            setIsSaving(false);
            // Hide success message after 3 seconds
            setTimeout(() => {
                setMessage(prev => prev.type === 'success' ? { type: '', text: '' } : prev);
            }, 3000);
        }
    };

    const handleCreateDbUser = async () => {
        if (!userFormData.username || !userFormData.password || !sessionId) return;
        setIsActionLoading(true);
        try {
            const res = await fetch('/api/db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create_db_user',
                    sessionId,
                    targetUser: userFormData.username,
                    targetHost: userFormData.host,
                    targetPassword: userFormData.password
                })
            });
            const data = await res.json();
            if (data.success) {
                setMessage({ type: 'success', text: data.message });
                setShowUserModal(null);
                setUserFormData({ host: '%', username: '', password: '' });
                fetchData(sessionId);
            } else {
                setMessage({ type: 'error', text: data.message });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'خطأ في العملية' });
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleChangeDbUserPassword = async () => {
        if (!userFormData.password || !sessionId || !selectedUser) return;
        setIsActionLoading(true);
        try {
            const res = await fetch('/api/db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'change_db_user_password',
                    sessionId,
                    targetUser: selectedUser.username,
                    targetHost: selectedUser.host,
                    newPassword: userFormData.password
                })
            });
            const data = await res.json();
            if (data.success) {
                setMessage({ type: 'success', text: data.message });
                setShowUserModal(null);
                setUserFormData({ host: '%', username: '', password: '' });
            } else {
                setMessage({ type: 'error', text: data.message });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'خطأ في العملية' });
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleDropDbUser = async () => {
        if (!sessionId || !selectedUser) return;
        if (!confirm(`هل أنت متأكد من حذف المستخدم \${selectedUser.username}@\${selectedUser.host} نهائياً من قاعدة البيانات؟`)) return;
        setIsActionLoading(true);
        try {
            const res = await fetch('/api/db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'drop_db_user',
                    sessionId,
                    targetUser: selectedUser.username,
                    targetHost: selectedUser.host,
                })
            });
            const data = await res.json();
            if (data.success) {
                setMessage({ type: 'success', text: data.message });
                setSelectedUser(null);
                fetchData(sessionId);
            } else {
                setMessage({ type: 'error', text: data.message });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'خطأ في العملية' });
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleDisconnect = () => {
        localStorage.removeItem('dbConnectionSession');
        localStorage.removeItem('dbTargetName');
        router.push('/db-admin');
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#0B1120] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-blue-400">
                    <Loader2 className="w-10 h-10 animate-spin" />
                    <p className="font-medium animate-pulse">جاري فحص قاعدة البيانات...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0B1120] text-slate-200 p-6 flex flex-col" dir="rtl">
            <div className="max-w-7xl w-full mx-auto flex-1 flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between mb-8 bg-slate-800/50 backdrop-blur-md p-6 rounded-2xl border border-slate-700/50 shadow-lg">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center border border-blue-500/30">
                            <Database className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white tracking-tight">مستكشف قاعدة البيانات</h1>
                            <p className="text-blue-400 text-sm mt-1 font-medium bg-blue-500/10 px-2 py-0.5 rounded-md inline-block">
                                متصل بـ: {dbName}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => router.push('/')}
                            className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 rounded-lg text-sm font-medium transition-all"
                        >
                            اللوحة الرئيسية
                        </button>
                        <button
                            onClick={handleDisconnect}
                            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg text-sm font-medium flex items-center gap-2 transition-all"
                        >
                            <LogOut className="w-4 h-4" />
                            إنهاء الاتصال
                        </button>
                    </div>
                </div>

                {message.text && (
                    <div className={`p-4 rounded-xl mb-6 flex items-start gap-3 border backdrop-blur-sm animate-in fade-in slide-in-from-top-2 \${
                        message.type === 'success' 
                            ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                            : 'bg-red-500/10 border-red-500/30 text-red-400'
                    }`}>
                        {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" /> : <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />}
                        <p className="font-medium text-sm leading-relaxed">{message.text}</p>
                    </div>
                )}

                {/* Main Content */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1">

                    {/* Columns 1: Tables */}
                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 flex flex-col h-[70vh]">
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <TableIcon className="w-5 h-5 text-indigo-400" />
                            الجداول ({tables.length})
                        </h2>
                        <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                            {tables.map(table => (
                                <button
                                    key={table}
                                    onClick={() => handleSelectTable(table)}
                                    className={`w-full text-right px-4 py-3 rounded-xl border transition-all \${
                                        selectedTable === table 
                                        ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.1)]' 
                                        : 'bg-slate-800/50 border-transparent hover:bg-slate-700 hover:border-slate-600 text-slate-300'
                                    }`}
                                >
                                    <span className="font-mono text-sm">{table}</span>
                                </button>
                            ))}
                            {tables.length === 0 && (
                                <p className="text-slate-500 text-center py-4 text-sm">لا توجد جداول.</p>
                            )}
                        </div>
                    </div>

                    {/* Column 2: Users */}
                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 flex flex-col h-[70vh]">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <User className="w-5 h-5 text-emerald-400" />
                                مستخدمي القاعدة ({users.length})
                            </h2>
                            <button
                                onClick={() => setShowUserModal('create')}
                                className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 p-1.5 rounded-lg border border-emerald-500/20 transition-colors"
                                title="إضافة مستخدم DB جديد"
                            >
                                <UserPlus className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                            {users.map(user => {
                                const userKey = `\${user.username}@\${user.host}`;
                                const isSelected = selectedUser?.username === user.username && selectedUser?.host === user.host;
                                return (
                                    <button
                                        key={userKey}
                                        onClick={() => handleSelectUser(user)}
                                        className={`w-full text-right px-4 py-3 rounded-xl border transition-all \${
                                            isSelected 
                                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                                            : 'bg-slate-800/50 border-transparent hover:bg-slate-700 hover:border-slate-600 text-slate-300'
                                        }`}
                                    >
                                        <div className="font-mono text-sm font-bold">{user.username}</div>
                                        <div className="text-xs text-slate-500 mt-1 font-mono">@{user.host}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Column 3 & 4: Permissions */}
                    <div className="lg:col-span-2 bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 flex flex-col h-[70vh] relative overflow-hidden">

                        {/* Background glow */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[100px] pointer-events-none rounded-full" />

                        <h2 className="text-xl font-bold text-white mb-2">إدارة الصلاحيات (Granular Access)</h2>
                        <p className="text-slate-400 text-sm mb-8">حدّد مستخدمًا وجدولًا لاستعراض وتعديل الصلاحيات المخصصة.</p>

                        {!selectedTable || !selectedUser ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 backdrop-blur-sm z-10 border border-slate-700/30 rounded-2xl bg-slate-800/20">
                                <ShieldAlert className="w-16 h-16 mb-4 opacity-50" />
                                <p className="text-lg">الرجاء اختيار <span className="text-indigo-400 font-bold">جدول</span> و<span className="text-emerald-400 font-bold">مستخدم</span> أولاً</p>
                            </div>
                        ) : isFetchingPermissions ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-blue-400 z-10">
                                <Loader2 className="w-10 h-10 animate-spin mb-4" />
                                <p>جاري قراءة الصلاحيات...</p>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col z-10">
                                <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-5 mb-8">
                                    <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-700/50">
                                        <div className="text-sm">
                                            <span className="text-slate-500 block mb-1">المستخدم المحدد (DB User):</span>
                                            <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 flex items-center gap-2 w-fit">
                                                {selectedUser.username}@{selectedUser.host}
                                                <button onClick={() => setShowUserModal('edit_pass')} className="text-emerald-400 hover:text-emerald-300" title="تغيير كلمة المرور"><Key className="w-3.5 h-3.5" /></button>
                                                <button onClick={handleDropDbUser} disabled={isActionLoading} className="text-red-400 hover:text-red-300" title="حذف حساب قواعد البيانات"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </span>
                                        </div>
                                        <div className="text-sm text-left">
                                            <span className="text-slate-500 block mb-1">الجدول المحدد للصلاحيات:</span>
                                            <span className="font-mono text-indigo-400 font-bold bg-indigo-500/10 px-2 py-1 rounded border border-indigo-500/20">{selectedTable}</span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-400">ملحوظة: يمكنك من هنا إعطاء أو سحب الصلاحيات من المستخدم على الجدول المحدد فقط.</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-8">
                                    {[
                                        { key: 'select', label: 'قراءة البيانات (SELECT)', color: 'text-blue-400', bgHover: 'hover:bg-blue-500/10' },
                                        { key: 'insert', label: 'إضافة بيانات (INSERT)', color: 'text-green-400', bgHover: 'hover:bg-green-500/10' },
                                        { key: 'update', label: 'تعديل بيانات (UPDATE)', color: 'text-yellow-400', bgHover: 'hover:bg-yellow-500/10' },
                                        { key: 'delete', label: 'حذف بيانات (DELETE)', color: 'text-red-400', bgHover: 'hover:bg-red-500/10' },
                                    ].map((perm) => {
                                        const isChecked = permissions[perm.key as keyof typeof permissions];
                                        return (
                                            <button
                                                key={perm.key}
                                                onClick={() => handleTogglePermission(perm.key as keyof typeof permissions)}
                                                className={`flex items-center gap-4 p-5 rounded-xl border transition-all text-right \${
                                                    isChecked 
                                                    ? 'bg-slate-700/80 border-slate-500' 
                                                    : 'bg-slate-800/50 border-slate-700/50 ' + perm.bgHover
                                                }`}
                                            >
                                                <div className={`shrink-0 transition-colors \${isChecked ? perm.color : 'text-slate-500'}`}>
                                                    {isChecked ? <CheckSquare className="w-6 h-6" /> : <Square className="w-6 h-6" />}
                                                </div>
                                                <div className="flex-1 font-medium font-mono">
                                                    <span className={isChecked ? 'text-slate-200' : 'text-slate-400'}>{perm.label}</span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="mt-auto">
                                    <button
                                        onClick={handleSavePermissions}
                                        disabled={isSaving}
                                        className="w-full py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isSaving ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                جاري تطبيق الصلاحيات...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="w-5 h-5" />
                                                تطبيق وحفظ الصلاحيات
                                            </>
                                        )}
                                    </button>
                                    <p className="text-center text-xs text-slate-500 mt-4 leading-relaxed">
                                        سيتم تنفيذ أمر GRANT أو REVOKE وحفظ التغييرات في قاعدة البيانات مباشرة عبر FLUSH PRIVILEGES.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* User Action Modal (Create / Edit Pass) */}
            {showUserModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-[#0B1120] border border-slate-700 w-full max-w-md rounded-2xl flex flex-col shadow-2xl overflow-hidden p-6 relative">
                        <button onClick={() => setShowUserModal(null)} className="absolute top-4 left-4 text-slate-400 hover:text-white transition-colors">
                            <X className="w-5 h-5" />
                        </button>

                        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            {showUserModal === 'create' ? <><UserPlus className="w-5 h-5 text-emerald-400" /> إنشاء مستخدم قاعدة بيانات جديد</> : <><Key className="w-5 h-5 text-yellow-400" /> تغيير كلمة المرور للمستخدم</>}
                        </h3>

                        {showUserModal === 'create' && (
                            <>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-slate-300 mb-2">اسم المستخدم (Username)</label>
                                    <input
                                        type="text"
                                        value={userFormData.username}
                                        onChange={(e) => setUserFormData(prev => ({ ...prev, username: e.target.value }))}
                                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2 outline-none focus:border-emerald-500"
                                        placeholder="مثال: app_reader"
                                        dir="ltr"
                                    />
                                </div>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-slate-300 mb-2">النطاق المسموح (Host)</label>
                                    <input
                                        type="text"
                                        value={userFormData.host}
                                        onChange={(e) => setUserFormData(prev => ({ ...prev, host: e.target.value }))}
                                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2 outline-none focus:border-emerald-500"
                                        placeholder="استخدم % للسماح بأي نطاق"
                                        dir="ltr"
                                    />
                                </div>
                            </>
                        )}

                        {showUserModal === 'edit_pass' && (
                            <div className="mb-6 bg-slate-800/50 p-3 rounded-lg border border-slate-700 text-sm">
                                <span className="text-slate-400">تغيير كلمة المرور للحساب:</span>
                                <div className="font-mono text-emerald-400 mt-1">{selectedUser?.username}@{selectedUser?.host}</div>
                            </div>
                        )}

                        <div className="mb-8">
                            <label className="block text-sm font-medium text-slate-300 mb-2">كلمة المرور {showUserModal === 'edit_pass' ? 'الجديدة' : ''}</label>
                            <input
                                type="password"
                                value={userFormData.password}
                                onChange={(e) => setUserFormData(prev => ({ ...prev, password: e.target.value }))}
                                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2 outline-none focus:border-emerald-500 font-mono"
                                dir="ltr"
                            />
                        </div>

                        <button
                            onClick={showUserModal === 'create' ? handleCreateDbUser : handleChangeDbUserPassword}
                            disabled={isActionLoading || !userFormData.password || (showUserModal === 'create' && !userFormData.username)}
                            className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition-colors"
                        >
                            {isActionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            {showUserModal === 'create' ? 'إنشاء الحساب' : 'حفظ التعديلات'}
                        </button>
                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(30, 41, 59, 0.5);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(71, 85, 105, 0.8);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(100, 116, 139, 1);
                }
            `}} />
        </div>
    );
}
