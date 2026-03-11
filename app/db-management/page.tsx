'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, ArrowRight, Trash2, Server, Database, Activity, RefreshCw } from 'lucide-react';

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

export default function DbManagementPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [user, setUser] = useState<{ id: number, username: string, role: string } | null>(null);

  // Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [connToDelete, setConnToDelete] = useState<Connection | null>(null);
  const [deleteActionLoading, setDeleteActionLoading] = useState(false);

  useEffect(() => {
    fetchUser().then(() => fetchConnections());
  }, []);

  const fetchUser = async () => {
    try {
      const resp = await fetch('/api/auth/me');
      const data = await resp.json();
      if (data.success && data.user) {
        if (data.user.role !== 'superadmin') {
          router.push('/'); // Redirect non-superadmins
        }
        setUser(data.user);
      } else {
        router.push('/login');
      }
    } catch (e) {
      console.error("Failed to fetch user", e);
    }
  };

  const fetchConnections = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_connection_history' })
      });
      const data = await resp.json();
      if (data.success) {
        setConnections(data.history);
      }
    } catch (e) {
      console.error("Failed to fetch connections", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const confirmDeleteModal = (conn: Connection) => {
    setConnToDelete(conn);
    setDeleteModalOpen(true);
  };

  const executeDeleteDb = async (wipeData: boolean) => {
    if (!connToDelete) return;
    setDeleteActionLoading(true);
    try {
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_connection', connectionId: connToDelete.id, wipeData })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDeleteModalOpen(false);
        setConnToDelete(null);
        fetchConnections();
      } else {
        alert(data.message || 'حدث خطأ في عملية الإزالة');
      }
    } catch (error) {
      console.error('Failed to delete connection', error);
      alert('تعذر الحذف في الوقت الحالي');
    } finally {
      setDeleteActionLoading(false);
    }
  };

  if (!user || user.role !== 'superadmin') return null;

  return (
    <div className="min-h-screen bg-[#0A0F1C] text-slate-200 p-8 font-sans selection:bg-blue-500/30" dir="rtl">
      <div className="max-w-5xl mx-auto flex flex-col gap-8">
        
        {/* Header */}
        <div className="flex items-center justify-between bg-slate-900/50 backdrop-blur-xl border border-white/5 p-6 rounded-3xl shadow-2xl">
          <div className="flex items-center gap-5">
            <button
              onClick={() => router.push('/')}
              className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/5 text-slate-400 hover:text-white"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-black text-white flex items-center gap-3">
                <Trash2 className="w-7 h-7 text-orange-500" />
                إزالة وإدارة قواعد البيانات
              </h1>
              <p className="text-slate-400 mt-1 text-sm">
                تحكم صارم بجلسات القواعد. بإمكانك الاكتفاء بقطع الاتصال، أو مسح القاعدة وإبادة سجلاتها كاملةً.
              </p>
            </div>
          </div>
          <button
            onClick={fetchConnections}
            className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/5 text-slate-400 hover:text-white"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Database List */}
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-[2rem] overflow-hidden shadow-2xl">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-white/5 text-slate-400 text-sm font-bold border-b border-white/5">
                <th className="px-8 py-5">قاعدة البيانات / المضيف</th>
                <th className="px-8 py-5">حالة الجلسة</th>
                <th className="px-8 py-5">تاريخ الإضافة</th>
                <th className="px-8 py-5 text-left">إجراء الحذف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && connections.length === 0 ? (
                <tr>
                   <td colSpan={4} className="py-20 text-center text-slate-500">جاري التحميل...</td>
                </tr>
              ) : connections.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-20 text-center text-slate-500">لا توجد سجلات اتصال بقواعد بيانات.</td>
                </tr>
              ) : (
                connections.map(conn => (
                  <tr key={conn.id} className="hover:bg-red-500/[0.02] transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex flex-shrink-0 items-center justify-center">
                          <Database className="w-5 h-5 text-orange-400" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-black text-white text-lg uppercase">{conn.database_name}</span>
                          <span className="text-xs text-slate-500 font-mono tracking-widest">{conn.username}@{conn.host}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${conn.status === 'active' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-red-500'}`} />
                        <span className={`text-sm font-bold ${conn.status === 'active' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {conn.status === 'active' ? 'متصل وحي' : 'مقطوع الاتصال'}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-sm text-slate-400 font-mono">
                        {new Date(conn.first_connected_at).toLocaleDateString('ar-SA')}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-left">
                      <button
                        onClick={() => confirmDeleteModal(conn)}
                        className="px-6 py-2.5 bg-red-600/10 hover:bg-red-500 text-red-400 hover:text-white rounded-xl font-bold border border-red-500/30 transition-all shadow-lg flex items-center justify-end gap-2 shrink-0 float-left"
                      >
                        <Trash2 className="w-4 h-4" />
                        الاستغناء أو الحذف
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Delete Confirmation Modal */}
        {deleteModalOpen && connToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-slate-900 border border-red-500/20 shadow-2xl rounded-2xl p-6 w-full max-w-xl shadow-red-900/20">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-red-500/20 rounded-full border border-red-500/30">
                    <ShieldAlert className="w-7 h-7 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white">إزالة قاعدة البيانات</h3>
                    <p className="text-sm text-slate-400">القاعدة المحددة: <strong className="text-orange-400">{connToDelete.database_name}</strong></p>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col gap-4 mt-2">
                <button
                  onClick={() => executeDeleteDb(false)}
                  disabled={deleteActionLoading}
                  className="w-full text-right p-5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl transition-all group"
                >
                  <p className="font-bold text-white mb-2 text-lg group-hover:text-blue-400 transition-colors">الاحتفاظ بالبيانات وإلغاء الاتصال فقط</p>
                  <p className="text-sm text-slate-400 leading-relaxed">سيتم قطع الاتصال بالقاعدة. <span className="text-emerald-400">ولكن سيتم الاحتفاظ بكافة سجلاتها التاريخية</span> وأرشيف الجلسات في النظام الأمني للرجوع إليها مستقبلاً.</p>
                </button>

                <button
                  onClick={() => executeDeleteDb(true)}
                  disabled={deleteActionLoading}
                  className="w-full text-right p-5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/40 rounded-2xl transition-all group"
                >
                  <p className="font-black text-red-500 mb-2 text-lg">إزالة جذرية (مسح كافة البيانات)</p>
                  <p className="text-sm text-slate-300 leading-relaxed">إجراء خطير: سيتم حذف القاعدة وجميع سجلاتها، وحركاتها الأمنية، وفصل مشغليها أو مرافبيها المرتبطة بها من النظام الأمني <strong className="text-red-400">بشكل نهائي لا رجعة فيه!</strong>.</p>
                </button>
              </div>

              <div className="mt-8 flex justify-end">
                <button 
                  onClick={() => { setDeleteModalOpen(false); setConnToDelete(null); }}
                  disabled={deleteActionLoading}
                  className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold transition-transform hover:scale-105"
                >
                  إلغاء والتراجع
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
