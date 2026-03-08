// ════════════════════════════════════════════════════════════
// FloatingHabiGuide – Floating AI Chatbot Widget (All Roles)
// Panel and trigger are separately fixed so input is never clipped
// ════════════════════════════════════════════════════════════
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Minimize2, Maximize2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FloatingChatWidget } from '@/components/shared/FloatingChatWidget';
import { useAuth } from '@/hooks/useAuth';
import { usePathname, useRouter } from 'next/navigation';

const ROLE_SUGGESTIONS: Record<string, string[]> = {
    salik: [
        "How do I stay consistent with Fajr when I sleep late?",
        "Give me a du'a for staying motivated in my Chilla.",
        "What does Islam say about managing time effectively?",
        "How can I improve my Quran recitation habit step by step?",
    ],
    murabbi: [
        "How do I give constructive feedback to a struggling Salik?",
        "What are encouraging ways to motivate late report submissions?",
        "How can I help a Salik who feels overwhelmed by their habits?",
        "Suggest a sunnah-based approach for managing a student's time struggles.",
    ],
    admin: [
        "How can I improve overall program engagement and submission rates?",
        "What metrics help evaluate a 40-day spiritual program's success?",
        "How do I identify Saliks who need extra mentor support?",
        "Best practices for scaling a spiritual consistency program?",
    ],
};

const ROLE_GRADIENT: Record<string, string> = {
    salik: 'from-violet-600 to-indigo-600',
    murabbi: 'from-blue-600 to-cyan-600',
    admin: 'from-emerald-600 to-teal-600',
};

const ROLE_LABEL: Record<string, string> = {
    salik: 'HabiGuide — Salik',
    murabbi: 'HabiGuide — Murrabi',
    admin: 'HabiGuide — Admin',
};

const AI_ROUTES: Record<string, string> = {
    salik: '/salik/ai-assistant',
    murabbi: '/murabbi/ai-assistant',
    admin: '/admin/ai-assistant',
};

// Hide on dedicated AI pages
const HIDE_PATHS = ['/ai-assistant'];

// Trigger button dimensions for offset calculation
const BTN_SIZE = 56;      // w-14 h-14
const BTN_BOTTOM = 24;    // bottom-6
const GAP = 12;           // gap between panel and button
const PANEL_OFFSET = BTN_SIZE + BTN_BOTTOM + GAP; // = 92px from bottom

export function FloatingHabiGuide() {
    const { profile, loading } = useAuth();
    const pathname = usePathname();
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [bounced, setBounced] = useState(false);

    useEffect(() => {
        const t1 = setTimeout(() => setBounced(true), 2500);
        const t2 = setTimeout(() => setBounced(false), 4200);
        return () => { clearTimeout(t1); clearTimeout(t2); };
    }, []);

    const shouldHide = HIDE_PATHS.some(p => pathname?.includes(p));
    if (loading || !profile || shouldHide) return null;

    const role = profile.role as 'salik' | 'murabbi' | 'admin';
    const chatRole: 'salik' | 'murabbi' = role === 'salik' ? 'salik' : 'murabbi';
    const gradient = ROLE_GRADIENT[role];
    const label = ROLE_LABEL[role];
    const suggestions = ROLE_SUGGESTIONS[role];
    const aiRoute = AI_ROUTES[role];

    const panelW = expanded ? 'min(520px, 92vw)' : 'min(400px, 90vw)';
    // Use 85vh with a cap that leaves the panel above the trigger button
    const panelH = expanded ? 'min(680px, calc(100vh - 110px))' : 'min(540px, calc(100vh - 110px))';

    return (
        <>
            {/* ── Chat Panel (independently fixed above the trigger) ── */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        key="chat-panel"
                        initial={{ opacity: 0, y: 16, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 16, scale: 0.96 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                        className="fixed z-50 flex flex-col rounded-2xl shadow-2xl border border-border/40 bg-card overflow-hidden"
                        style={{
                            bottom: PANEL_OFFSET,
                            right: 24,
                            width: panelW,
                            height: panelH,
                        }}
                    >
                        {/* Header */}
                        <div className={`flex items-center justify-between px-4 py-3 bg-gradient-to-r ${gradient} flex-shrink-0`}>
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                                    <Sparkles size={15} className="text-white" />
                                </div>
                                <div>
                                    <p className="font-bold text-sm text-white leading-tight">{label}</p>
                                    <p className="text-[10px] text-white/65">AI-powered spiritual guidance ✨</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-0.5">
                                <Button
                                    variant="ghost" size="icon"
                                    className="h-7 w-7 text-white/80 hover:bg-white/20 rounded-lg"
                                    onClick={() => { setOpen(false); router.push(aiRoute); }}
                                    title="Open full page"
                                >
                                    <ExternalLink size={13} />
                                </Button>
                                <Button
                                    variant="ghost" size="icon"
                                    className="h-7 w-7 text-white/80 hover:bg-white/20 rounded-lg"
                                    onClick={() => setExpanded(e => !e)}
                                    title={expanded ? 'Compact' : 'Expand'}
                                >
                                    {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                                </Button>
                                <Button
                                    variant="ghost" size="icon"
                                    className="h-7 w-7 text-white/80 hover:bg-white/20 rounded-lg"
                                    onClick={() => setOpen(false)}
                                    title="Close"
                                >
                                    <X size={14} />
                                </Button>
                            </div>
                        </div>

                        {/* Chat body */}
                        <div className="flex-1 min-h-0 overflow-hidden">
                            <FloatingChatWidget
                                suggestions={suggestions}
                                roleGradient={gradient}
                                chatRole={chatRole}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Trigger Button (fixed independently at bottom-right) ── */}
            <motion.button
                className={`fixed z-50 flex items-center justify-center cursor-pointer focus:outline-none
                            rounded-2xl bg-gradient-to-br ${gradient} border-2 border-white/20 shadow-xl`}
                style={{ bottom: BTN_BOTTOM, right: 24, width: BTN_SIZE, height: BTN_SIZE }}
                onClick={() => setOpen(o => !o)}
                animate={bounced && !open ? { y: [0, -10, 0, -5, 0] } : {}}
                transition={{ duration: 0.55, ease: 'easeOut' }}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.94 }}
                aria-label="Open HabiGuide AI assistant"
            >
                <AnimatePresence mode="wait">
                    {open ? (
                        <motion.div key="x"
                            initial={{ rotate: -90, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ rotate: 90, opacity: 0 }}
                            transition={{ duration: 0.15 }}>
                            <X size={22} className="text-white" />
                        </motion.div>
                    ) : (
                        <motion.div key="spark"
                            initial={{ rotate: 90, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ rotate: -90, opacity: 0 }}
                            transition={{ duration: 0.15 }}>
                            <Sparkles size={22} className="text-white" />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Pulse ring when closed */}
                {!open && (
                    <span
                        className="absolute inset-0 rounded-2xl animate-ping bg-white/25 pointer-events-none"
                        style={{ animationDuration: '2.8s' }}
                    />
                )}
            </motion.button>
        </>
    );
}
