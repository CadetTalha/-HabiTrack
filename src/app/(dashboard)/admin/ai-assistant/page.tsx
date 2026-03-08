// ════════════════════════════════════════════════════════════
// Admin – HabiGuide AI Page (Redesigned)
// ════════════════════════════════════════════════════════════
'use client';

import { ChatInterface } from '@/components/shared/ChatInterface';
import { motion } from 'framer-motion';
import { Sparkles, Shield, Brain, BookOpen, Zap } from 'lucide-react';

const ADMIN_SUGGESTIONS = [
    "How can I improve overall program engagement and submission rates?",
    "What metrics help evaluate a 40-day spiritual program's success?",
    "How do I identify Saliks who need extra mentor support?",
    "Best practices for scaling a spiritual consistency program?",
];

const FEATURES = [
    { icon: <Brain size={13} />, label: 'Program Analytics' },
    { icon: <Shield size={13} />, label: 'Admin Insights' },
    { icon: <Zap size={13} />, label: 'Real-time Context' },
    { icon: <BookOpen size={13} />, label: 'Islamic Guidance' },
];

export default function AdminAIAssistantPage() {
    return (
        <div className="flex flex-col gap-4">

            {/* ── Hero Header ── */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="relative overflow-hidden rounded-2xl mb-4 flex-shrink-0
                           bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700
                           shadow-lg shadow-emerald-900/20"
            >
                {/* Decorative blobs */}
                <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
                <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-black/10 blur-xl pointer-events-none" />

                <div className="relative z-10 px-6 py-4 flex items-center justify-between gap-6">
                    {/* Left: icon + title */}
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-inner flex-shrink-0">
                            <Sparkles size={22} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white tracking-tight leading-tight">
                                HabiGuide ✨
                                <span className="ml-2 text-xs font-semibold bg-white/20 text-white px-2 py-0.5 rounded-full align-middle">
                                    Admin
                                </span>
                            </h1>
                            <p className="text-sm text-white/70 mt-0.5 leading-snug max-w-md">
                                AI-powered program guidance — strategic insights for managing the HabiTrack Chilla program.
                            </p>
                        </div>
                    </div>

                    {/* Right: feature pills */}
                    <div className="hidden sm:flex flex-wrap items-center gap-2 justify-end flex-shrink-0">
                        {FEATURES.map(f => (
                            <span
                                key={f.label}
                                className="flex items-center gap-1.5 text-[11px] font-medium text-white/85
                                           bg-white/[0.12] border border-white/20 rounded-full px-3 py-1"
                            >
                                {f.icon}
                                {f.label}
                            </span>
                        ))}
                    </div>
                </div>
            </motion.div>

            {/* ── Chat Interface (fills remaining height) ── */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.08 }}
                className="rounded-2xl overflow-hidden shadow-sm border border-border/40 [&>div]:!h-full"
                style={{ height: 'calc(100vh - 88px - 80px - 16px)' }}
            >
                <ChatInterface role="murabbi" suggestions={ADMIN_SUGGESTIONS} />
            </motion.div>
        </div>
    );
}
