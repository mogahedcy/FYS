'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { KeyRound, Users, ShieldAlert, Terminal, Shield, LayoutGrid, UserCog } from 'lucide-react';

const subNav = [
    { href: '/activity-logs/security', label: 'نظرة عامة', icon: LayoutGrid, exact: true, color: 'slate' },
    { href: '/activity-logs/security/permissions', label: 'الصلاحيات', icon: KeyRound, exact: false, color: 'indigo' },
    { href: '/activity-logs/security/users', label: 'مستخدمو MySQL', icon: Users, exact: false, color: 'blue' },
    { href: '/activity-logs/security/app-users', label: 'مستخدمو التطبيق', icon: UserCog, exact: false, color: 'purple' },
    { href: '/activity-logs/security/brute-force', label: 'كشف الهجمات', icon: ShieldAlert, exact: false, color: 'red' },
    { href: '/activity-logs/security/patcher', label: 'الترقيع الذكي', icon: Terminal, exact: false, color: 'amber' },
];

const colorMap: Record<string, { active: string; inactive: string; dot: string }> = {
    slate: { active: 'bg-slate-600 text-white border-slate-500', inactive: 'text-slate-400 hover:text-white hover:bg-slate-800 border-transparent', dot: 'bg-slate-400' },
    indigo: { active: 'bg-indigo-600 text-white border-indigo-500 shadow-[0_0_14px_rgba(99,102,241,0.5)]', inactive: 'text-indigo-400 hover:bg-indigo-500/10 border-transparent', dot: 'bg-indigo-400' },
    blue: { active: 'bg-blue-600 text-white border-blue-500 shadow-[0_0_14px_rgba(59,130,246,0.5)]', inactive: 'text-blue-400 hover:bg-blue-500/10 border-transparent', dot: 'bg-blue-400' },
    purple: { active: 'bg-purple-600 text-white border-purple-500 shadow-[0_0_14px_rgba(168,85,247,0.5)]', inactive: 'text-purple-400 hover:bg-purple-500/10 border-transparent', dot: 'bg-purple-400' },
    red: { active: 'bg-red-600 text-white border-red-500 shadow-[0_0_14px_rgba(239,68,68,0.5)]', inactive: 'text-red-400 hover:bg-red-500/10 border-transparent', dot: 'bg-red-400' },
    amber: { active: 'bg-amber-600 text-white border-amber-500 shadow-[0_0_14px_rgba(245,158,11,0.5)]', inactive: 'text-amber-400 hover:bg-amber-500/10 border-transparent', dot: 'bg-amber-400' },
};

export default function SecurityLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="flex flex-col gap-5 animate-in fade-in duration-300">

            {/* ── Security Section Header ── */}
            <div className="flex items-center gap-4 bg-gradient-to-l from-red-900/20 via-purple-900/10 to-transparent border border-slate-700/40 rounded-2xl px-6 py-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(220,38,38,0.12),transparent_60%)] pointer-events-none" />
                <div className="w-10 h-10 bg-red-500/20 border border-red-500/40 rounded-xl flex items-center justify-center shadow-[0_0_16px_rgba(239,68,68,0.25)] shrink-0">
                    <Shield className="w-5 h-5 text-red-400" />
                </div>
                <div>
                    <h2 className="font-bold text-white text-base">مركز الأمن السيبراني</h2>
                    <p className="text-xs text-slate-500 mt-0.5">إدارة الصلاحيات · مستخدمو قاعدة البيانات · كشف الهجمات · الترقيع الذكي</p>
                </div>
            </div>

            {/* ── Sub Navigation ── */}
            <nav className="flex items-center gap-2 overflow-x-auto pb-1">
                {subNav.map(item => {
                    const Icon = item.icon;
                    const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href) && !item.exact;
                    const { active, inactive, dot } = colorMap[item.color];
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold whitespace-nowrap transition-all duration-300 ${isActive ? active : inactive}`}
                        >
                            {isActive && <span className={`w-1.5 h-1.5 rounded-full ${dot} shrink-0`} />}
                            <Icon className="w-4 h-4 shrink-0" />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            {/* ── Page Content ── */}
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                {children}
            </div>
        </div>
    );
}
