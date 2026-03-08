// ════════════════════════════════════════════════════════════
// Dashboard Layout – Main Shell
// ════════════════════════════════════════════════════════════
'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { Navbar } from '@/components/layout/Navbar';
import { FloatingHabiGuide } from '@/components/shared/FloatingHabiGuide';
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext';

function DashboardShell({ children }: { children: React.ReactNode }) {
    const { collapsed } = useSidebar();

    return (
        <div className="min-h-screen bg-background relative flex">
            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute inset-0 islamic-pattern opacity-[0.02] dark:opacity-[0.05]" />
                <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px]" />
                <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[120px]" />
            </div>

            {/* Sidebar — fixed, width driven by context */}
            <Sidebar />

            {/* Main Content — margin driven by same context */}
            <div
                className="flex-1 flex flex-col min-w-0 transition-all duration-300"
                style={{ marginLeft: collapsed ? 80 : 270 }}
            >
                <div className="sticky top-0 z-30 pt-4 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-background via-background/95 to-transparent pb-4">
                    <Navbar />
                </div>

                <main className="flex-1 relative z-10 p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full pt-2">
                    {children}
                </main>
            </div>

            {/* Floating HabiGuide */}
            <FloatingHabiGuide />
        </div>
    );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
            <DashboardShell>{children}</DashboardShell>
        </SidebarProvider>
    );
}
