// ════════════════════════════════════════════════════════════
// SidebarContext – Shared collapsed state for Sidebar + Layout
// ════════════════════════════════════════════════════════════
'use client';

import { createContext, useContext, useState } from 'react';

interface SidebarContextValue {
    collapsed: boolean;
    setCollapsed: (v: boolean) => void;
    toggle: () => void;
}

const SidebarContext = createContext<SidebarContextValue>({
    collapsed: true,
    setCollapsed: () => { },
    toggle: () => { },
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
    const [collapsed, setCollapsed] = useState(true);
    const toggle = () => setCollapsed(v => !v);

    return (
        <SidebarContext.Provider value={{ collapsed, setCollapsed, toggle }}>
            {children}
        </SidebarContext.Provider>
    );
}

export function useSidebar() {
    return useContext(SidebarContext);
}
