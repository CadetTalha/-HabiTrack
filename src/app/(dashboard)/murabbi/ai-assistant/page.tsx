// ════════════════════════════════════════════════════════════
// Murrabi – HabiGuide AI Page (Redesigned)
// ════════════════════════════════════════════════════════════
'use client';

import { ChatInterface } from '@/components/shared/ChatInterface';
import { motion } from 'framer-motion';
import { Sparkles, Users, MessageSquare, BarChart3, BookOpen } from 'lucide-react';

const MURABBI_SUGGESTIONS = [
    "How do I give constructive feedback to a Salik who misses Fajr consistently?",
    "Draft an encouraging message for a Salik who completed their first Chilla.",
    "How can I help a Salik who is struggling with time management?",
    "What Islamic approach works best for motivating a discouraged student?",
];

const FEATURES = [
    { icon: <Users size={13} />, label: 'Salik Context' },
    { icon: <MessageSquare size={13} />, label: 'Mentorship Advice' },
    { icon: <BarChart3 size={13} />, label: 'Performance Insights' },
    { icon: <BookOpen size={13} />, label: 'Islamic Guidance' },
];

export default function MurabbiAIAssistantPage() {
    return (
        <div className="flex flex-col gap-4">

            {/* ── Hero Header ── */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="relative overflow-hidden rounded-2xl mb-4 flex-shrink-0
                           bg-gradient-to-br from-blue-600 via-blue-700 to-cyan-700
                           shadow-lg shadow-blue-900/20"
            >
                <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
                <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-black/10 blur-xl pointer-events-none" />

                <div className="relative z-10 px-6 py-4 flex items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-inner flex-shrink-0">
                            <Sparkles size={22} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white tracking-tight leading-tight">
                                HabiGuide ✨
                                <span className="ml-2 text-xs font-semibold bg-white/20 text-white px-2 py-0.5 rounded-full align-middle">
                                    Murrabi
                                </span>
                            </h1>
                            <p className="text-sm text-white/70 mt-0.5 leading-snug max-w-md">
                                Your AI mentorship companion — get personalized advice for guiding your Saliks through their Chilla.
                            </p>
                        </div>
                    </div>

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

            {/* ── Chat Interface ── */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.08 }}
                className="rounded-2xl overflow-hidden shadow-sm border border-border/40 [&>div]:!h-full"
                style={{ height: 'calc(100vh - 88px - 80px - 16px)' }}
            >
                <ChatInterface role="murabbi" suggestions={MURABBI_SUGGESTIONS} />
            </motion.div>
        </div>
    );
}
