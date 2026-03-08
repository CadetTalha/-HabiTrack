// ════════════════════════════════════════════════════════════
// Sidebar Component – Premium Role-Based Navigation
// ════════════════════════════════════════════════════════════
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/contexts/SidebarContext';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard, Users, FileText, Settings, BarChart3,
    MessageSquare, ClipboardList, BookOpen, Bell, LogOut,
    ChevronLeft, Menu, UserCog, CalendarDays, Sparkles, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useState, useEffect } from 'react';
import { FaMosque } from 'react-icons/fa';

interface NavItem {
    label: string;
    href: string;
    icon: React.ReactNode;
}

const NAV_ITEMS: Record<string, NavItem[]> = {
    admin: [
        { label: 'Dashboard', href: '/admin', icon: <LayoutDashboard size={18} /> },
        { label: 'Manage Murabbis', href: '/admin/murabbis', icon: <UserCog size={18} /> },
        { label: 'Manage Saliks', href: '/admin/saliks', icon: <Users size={18} /> },
        { label: 'Analytics', href: '/admin/analytics', icon: <BarChart3 size={18} /> },
        { label: 'Activity Logs', href: '/admin/logs', icon: <FileText size={18} /> },
        { label: 'Direct Messages', href: '/messages', icon: <MessageSquare size={18} /> },
        { label: 'Settings', href: '/admin/settings', icon: <Settings size={18} /> },
        { label: 'HabiGuide AI', href: '/admin/ai-assistant', icon: <Sparkles size={18} /> },
    ],
    murabbi: [
        { label: 'Overview', href: '/murabbi', icon: <LayoutDashboard size={18} /> },
        { label: 'My Saliks', href: '/murabbi/saliks', icon: <Users size={18} /> },
        { label: 'Templates', href: '/murabbi/templates', icon: <ClipboardList size={18} /> },
        { label: 'Performance', href: '/murabbi/performance', icon: <BarChart3 size={18} /> },
        { label: 'Chilla Summary', href: '/murabbi/chilla', icon: <CalendarDays size={18} /> },
        { label: 'Direct Messages', href: '/messages', icon: <MessageSquare size={18} /> },
        { label: 'AI Guide', href: '/murabbi/ai-assistant', icon: <Sparkles size={18} /> },
        { label: 'Settings', href: '/profile', icon: <Settings size={18} /> },
    ],
    salik: [
        { label: 'Journey', href: '/salik', icon: <LayoutDashboard size={18} /> },
        { label: 'Daily Amal', href: '/salik/report', icon: <BookOpen size={18} /> },
        { label: 'Direct Messages', href: '/messages', icon: <MessageSquare size={18} /> },
        { label: 'My Progress', href: '/salik/progress', icon: <BarChart3 size={18} /> },
        { label: 'HabiGuide AI', href: '/salik/ai-assistant', icon: <Sparkles size={18} /> },
        { label: 'Alerts', href: '/salik/notifications', icon: <Bell size={18} /> },
        { label: 'Settings', href: '/profile', icon: <Settings size={18} /> },
    ],
};

const ROLE_LABELS: Record<string, string> = {
    admin: 'Administrator',
    murabbi: 'Murabbi Mentor',
    salik: 'Salik Seeker',
};

export function Sidebar() {
    const { profile, signOut } = useAuth();
    const pathname = usePathname();
    const { collapsed, toggle } = useSidebar();
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => { setMobileOpen(false); }, [pathname]);
    useEffect(() => {
        document.body.style.overflow = mobileOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [mobileOpen]);

    if (!profile) return null;

    const navItems = NAV_ITEMS[profile.role] || [];
    const initials = profile.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

    const sidebarContent = (isMobile: boolean) => (
        <div className="flex flex-col h-full bg-sidebar/95 backdrop-blur-xl relative overflow-hidden">
            {/* Islamic subtle background pattern */}
            <div className="absolute inset-0 opacity-[0.03] islamic-pattern pointer-events-none" />

            {/* Glowing orb effect behind logo */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-primary/20 rounded-full blur-[40px] pointer-events-none" />

            {/* Header */}
            <div className="flex items-center gap-3 px-5 h-20 flex-shrink-0 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/40 to-primary/10 flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/10 flex-shrink-0">
                    <FaMosque className="text-xl text-primary" />
                </div>
                {(isMobile || !collapsed) && (
                    <motion.div initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} className="flex-1 min-w-0">
                        <span className="font-bold text-base tracking-tight text-sidebar-foreground">
                            HabiTrack
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary/80 animate-pulse" />
                            <span className="text-[10px] font-medium text-sidebar-foreground/50 uppercase tracking-widest">
                                {ROLE_LABELS[profile.role]}
                            </span>
                        </div>
                    </motion.div>
                )}
                {isMobile ? (
                    <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} className="ml-auto text-sidebar-foreground/60 hover:text-white hover:bg-white/10">
                        <X size={18} />
                    </Button>
                ) : (
                    <Button variant="ghost" size="icon" onClick={toggle} className="ml-auto text-sidebar-foreground/60 hover:text-white hover:bg-white/10 hidden lg:flex rounded-xl">
                        <ChevronLeft size={16} className={cn('transition-transform duration-300', collapsed && 'rotate-180')} />
                    </Button>
                )}
            </div>

            <div className="mx-5 h-[1px] bg-gradient-to-r from-transparent via-sidebar-border to-transparent opacity-50 relative z-10" />

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1.5 relative z-10 scrollbar-hide">
                {navItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== `/${profile.role}` && pathname.startsWith(item.href));

                    const linkEl = (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'flex items-center gap-3.5 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-300 group relative overflow-hidden',
                                isActive
                                    ? 'text-primary-foreground'
                                    : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-white/5'
                            )}
                        >
                            {/* Active background glow */}
                            {isActive && (
                                <motion.div
                                    layoutId="active-nav-bg"
                                    className="absolute inset-0 bg-primary/90 opacity-100 border border-primary/50 shadow-[0_0_15px_rgba(var(--primary),0.3)]"
                                    initial={false}
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                />
                            )}

                            <span className={cn(
                                'relative z-10 flex-shrink-0 transition-transform duration-300',
                                isActive ? 'scale-110 drop-shadow-md' : 'group-hover:scale-110'
                            )}>
                                {item.icon}
                            </span>

                            {(isMobile || !collapsed) && (
                                <span className="relative z-10 whitespace-nowrap">
                                    {item.label}
                                </span>
                            )}

                            {/* Active Left Indicator Indicator */}
                            {isActive && (
                                <motion.div
                                    layoutId="active-indicator"
                                    className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-white rounded-r-full shadow-[0_0_10px_rgba(255,255,255,0.8)]"
                                />
                            )}
                        </Link>
                    );

                    if (!isMobile && collapsed) {
                        return (
                            <Tooltip key={item.href} delayDuration={0}>
                                <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                                <TooltipContent side="right" className="font-semibold px-3 py-1.5 border-primary/20 shadow-xl">{item.label}</TooltipContent>
                            </Tooltip>
                        );
                    }

                    return linkEl;
                })}
            </nav>

            {/* User Profile Footer */}
            <div className="p-4 relative z-10">
                <div className="h-[1px] bg-gradient-to-r from-transparent via-sidebar-border/50 to-transparent mb-4" />
                <Link
                    href="/profile"
                    className={cn(
                        'flex items-center gap-3 rounded-2xl p-2 transition-all hover:bg-white/5 group/profile',
                        (!isMobile && collapsed) ? 'justify-center p-0' : 'bg-black/20 border border-white/5'
                    )}
                >
                    <Avatar className="w-10 h-10 flex-shrink-0 border border-sidebar-border/50 shadow-inner group-hover/profile:border-primary/50 transition-colors">
                        <AvatarImage src={profile.avatar_url} />
                        <AvatarFallback className="bg-gradient-to-tr from-sidebar-primary to-primary text-white text-xs font-bold tracking-wider">
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                    {(isMobile || !collapsed) && (
                        <div className="flex-1 min-w-0 pr-2">
                            <p className="text-sm font-semibold text-sidebar-foreground truncate group-hover/profile:text-primary transition-colors">{profile.full_name}</p>
                            <p className="text-[10px] text-primary/80 font-bold truncate mt-0.5 uppercase tracking-tighter">View Profile</p>
                        </div>
                    )}
                </Link>
                {(isMobile || !collapsed) && (
                    <div className="flex justify-end px-2 mt-2">
                        <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={signOut} className="text-sidebar-foreground/40 hover:text-red-400 hover:bg-red-500/10 h-8 w-8 rounded-lg flex-shrink-0">
                                    <LogOut size={16} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Sign out</TooltipContent>
                        </Tooltip>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <>
            {/* Mobile hamburger - Glassy & Premium */}
            <Button
                variant="outline"
                size="icon"
                className="fixed top-3.5 left-4 z-50 lg:hidden bg-background/60 backdrop-blur-xl border-border/40 shadow-sm rounded-xl"
                onClick={() => setMobileOpen(true)}
            >
                <Menu size={18} className="text-foreground/80" />
            </Button>

            {/* Desktop Sidebar — fixed, margin coordinated via SidebarContext */}
            <motion.aside
                initial={false}
                animate={{ width: collapsed ? 80 : 270 }}
                transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
                className="fixed left-0 top-0 h-screen bg-sidebar text-sidebar-foreground z-40 border-r border-sidebar-border shadow-2xl hidden lg:block overflow-hidden"
            >
                {sidebarContent(false)}
            </motion.aside>

            {/* Mobile Drawer */}
            <AnimatePresence>
                {mobileOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60] lg:hidden"
                            onClick={() => setMobileOpen(false)}
                        />
                        <motion.aside
                            initial={{ x: -300 }}
                            animate={{ x: 0 }}
                            exit={{ x: -300 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed left-0 top-0 h-screen w-[280px] bg-sidebar text-sidebar-foreground z-[70] lg:hidden shadow-2xl overflow-hidden"
                        >
                            {sidebarContent(true)}
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
