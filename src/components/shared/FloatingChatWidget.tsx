// ════════════════════════════════════════════════════════════
// FloatingChatWidget – Compact single-column chat for the
// floating HabiGuide popup. No sidebar, no threads.
// ════════════════════════════════════════════════════════════
'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

interface FloatingChatWidgetProps {
    suggestions: string[];
    roleGradient: string;
    chatRole: 'salik' | 'murabbi';
}

export function FloatingChatWidget({ suggestions, roleGradient, chatRole }: FloatingChatWidgetProps) {
    const { profile } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-scroll on new message
    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, loading]);

    const sendMessage = async (text?: string) => {
        const content = (text ?? input).trim();
        if (!content || loading) return;

        const userMsg: Message = { id: Date.now().toString(), role: 'user', content };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            // Build conversation history for context
            const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));

            const res = await fetch('/api/ai/quick-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: history }),
            });

            if (!res.ok) throw new Error('Failed');

            const data = await res.json();
            const reply = data.response || data.message || 'JazakAllah Khair for your message.';

            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: reply,
            }]);
        } catch {
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: "JazakAllah Khair for your patience. I'm having trouble connecting right now — please try again in a moment. 🤲",
            }]);
        } finally {
            setLoading(false);
            textareaRef.current?.focus();
        }
    };

    const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    };

    const initials = profile?.full_name
        ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        : 'U';

    // Welcome / empty state
    const showWelcome = messages.length === 0;

    return (
        <div className="flex flex-col h-full bg-card">
            {/* Message Area */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-hide min-h-0"
            >
                {showWelcome ? (
                    <div className="flex flex-col items-center justify-center h-full pt-4 pb-2 text-center gap-4">
                        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${roleGradient} flex items-center justify-center shadow-lg`}>
                            <Sparkles size={24} className="text-white" />
                        </div>
                        <div>
                            <p className="font-bold text-foreground text-base">HabiGuide ✨</p>
                            <p className="text-xs text-muted-foreground mt-1 max-w-[220px] leading-relaxed">
                                Your AI spiritual companion. Ask me anything about your journey.
                            </p>
                        </div>
                        <div className="flex flex-col gap-2 w-full mt-2">
                            {suggestions.slice(0, 3).map((s, i) => (
                                <button
                                    key={i}
                                    onClick={() => sendMessage(s)}
                                    className="text-left text-xs px-3 py-2.5 rounded-xl bg-secondary/60 hover:bg-secondary border border-border/40 text-foreground/80 hover:text-foreground transition-all duration-150 leading-relaxed"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <AnimatePresence initial={false}>
                        {messages.map((msg) => (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2 }}
                                className={cn('flex gap-2.5', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
                            >
                                {/* Avatar */}
                                <Avatar className="w-7 h-7 flex-shrink-0 mt-0.5">
                                    <AvatarFallback className={cn(
                                        'text-[10px] font-bold',
                                        msg.role === 'assistant'
                                            ? `bg-gradient-to-br ${roleGradient} text-white`
                                            : 'bg-secondary text-foreground'
                                    )}>
                                        {msg.role === 'assistant' ? '✨' : initials}
                                    </AvatarFallback>
                                </Avatar>

                                {/* Bubble */}
                                <div className={cn(
                                    'max-w-[82%] rounded-2xl px-3 py-2.5 text-[13px] leading-relaxed shadow-sm',
                                    msg.role === 'user'
                                        ? `bg-gradient-to-br ${roleGradient} text-white rounded-tr-sm`
                                        : 'bg-secondary/70 text-foreground rounded-tl-sm border border-border/30'
                                )}>
                                    {msg.role === 'assistant' ? (
                                        <div className="prose prose-sm dark:prose-invert max-w-none text-[13px] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                                        </div>
                                    ) : (
                                        <p className="whitespace-pre-wrap">{msg.content}</p>
                                    )}
                                </div>
                            </motion.div>
                        ))}

                        {/* Typing indicator */}
                        {loading && (
                            <motion.div
                                key="typing"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex gap-2.5"
                            >
                                <Avatar className="w-7 h-7 flex-shrink-0">
                                    <AvatarFallback className={`bg-gradient-to-br ${roleGradient} text-white text-[10px]`}>✨</AvatarFallback>
                                </Avatar>
                                <div className="bg-secondary/70 border border-border/30 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                                    {[0, 1, 2].map(i => (
                                        <motion.div
                                            key={i}
                                            className="w-1.5 h-1.5 rounded-full bg-primary/60"
                                            animate={{ y: [0, -5, 0] }}
                                            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                                        />
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                )}
            </div>

            {/* Input Area */}
            <div className="flex-shrink-0 border-t border-border/40 bg-background/60 backdrop-blur-sm px-3 py-3">
                {/* Quick suggestions when there are messages */}
                {messages.length > 0 && messages.length < 4 && (
                    <div className="flex gap-1.5 mb-2.5 flex-wrap">
                        {suggestions.slice(0, 2).map((s, i) => (
                            <button
                                key={i}
                                onClick={() => sendMessage(s)}
                                disabled={loading}
                                className="text-[10px] px-2.5 py-1 rounded-full bg-secondary/60 hover:bg-secondary border border-border/40 text-muted-foreground hover:text-foreground transition-all truncate max-w-[160px]"
                            >
                                {s.length > 35 ? s.slice(0, 35) + '…' : s}
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex items-end gap-2">
                    <Textarea
                        ref={textareaRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKey}
                        placeholder="Ask HabiGuide anything…"
                        rows={1}
                        className="resize-none text-sm min-h-[38px] max-h-[100px] flex-1 rounded-xl bg-secondary/40 border-border/40 focus:border-primary/40 focus:ring-0 placeholder:text-muted-foreground/50 py-2.5 px-3 overflow-y-auto scrollbar-hide"
                        style={{ height: 'auto' }}
                        onInput={e => {
                            const t = e.currentTarget;
                            t.style.height = 'auto';
                            t.style.height = Math.min(t.scrollHeight, 100) + 'px';
                        }}
                        disabled={loading}
                    />
                    <Button
                        size="icon"
                        onClick={() => sendMessage()}
                        disabled={!input.trim() || loading}
                        className={`w-9 h-9 rounded-xl flex-shrink-0 bg-gradient-to-br ${roleGradient} hover:opacity-90 border-0 shadow-md disabled:opacity-40`}
                    >
                        {loading ? <Loader2 size={15} className="animate-spin text-white" /> : <Send size={15} className="text-white" />}
                    </Button>
                </div>

                {/* Reset conversation */}
                {messages.length > 0 && (
                    <button
                        onClick={() => setMessages([])}
                        className="mt-2 text-[10px] text-muted-foreground/50 hover:text-muted-foreground flex items-center gap-1 transition-colors mx-auto"
                    >
                        <RefreshCw size={9} />
                        New conversation
                    </button>
                )}
            </div>
        </div>
    );
}
