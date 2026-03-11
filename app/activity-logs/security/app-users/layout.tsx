'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserCog, Activity, Shield } from 'lucide-react';

const tabs = [
    { href: '/activity-logs/security/app-users', label: 'إدارة المستخدمين', icon: UserCog, exact: true, color: 'purple' },
    { href: '/activity-logs/security/app-users/activity', label: 'سجل النشاط', icon: Activity, exact: false, color: 'indigo' },
    { href: '/activity-logs/security/app-users/permissions', label: 'الصلاحيات', icon: Shield, exact: false, color: 'emerald' },
];

const colorMap: Record<string, { active: string; inactive: string }> = {
    purple: { active: 'bg-purple-600 border-purple-500 text-white shadow-[0_0_12px_rgba(168,85,247,0.4)]', inactive: 'border-transparent text-purple-400 hover:bg-purple-500/10' },
    indigo: { active: 'bg-indigo-600 border-indigo-500 text-white shadow-[0_0_12px_rgba(99,102,241,0.4)]', inactive: 'border-transparent text-indigo-400 hover:bg-indigo-500/10' },
    emerald: { active: 'bg-emerald-600 border-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.4)]', inactive: 'border-transparent text-emerald-400 hover:bg-emerald-500/10' },
};

export default function AppUsersLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    return (
        <div className="flex flex-col gap-5">
            {/* Sub-nav */}
            <nav className="flex items-center gap-2 bg-slate-800/30 border border-slate-700/40 rounded-2xl p-1.5">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href) && !tab.exact;
                    const { active, inactive } = colorMap[tab.color];
                    return (
                        <Link key={tab.href} href={tab.href}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold whitespace-nowrap transition-all duration-200 flex-1 justify-center ${isActive ? active : inactive}`}>
                            <Icon className="w-4 h-4 shrink-0" />
                            {tab.label}
                        </Link>
                    );
                })}
            </nav>
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                {children}
            </div>
        </div>
    );
}
