// ════════════════════════════════════════════════════════════
// ChatInterface – AI Chatbot with Threads & Markdown Rendering
// ════════════════════════════════════════════════════════════
'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, Loader2, BookOpen, Plus, MessageSquare, Trash2, Bookmark, BookmarkCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { createClient } from '@/lib/supabase/client';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    is_bookmarked?: boolean;
}

interface Thread {
    id: string;
    title: string;
    last_message_at: string;
}

interface ChatInterfaceProps {
    role: 'salik' | 'murabbi';
    suggestions: string[];
}

export function ChatInterface({ role, suggestions }: ChatInterfaceProps) {
    const supabase = createClient();

    // State
    const [threads, setThreads] = useState<Thread[]>([]);
    const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);

    // UI State
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingThreads, setIsFetchingThreads] = useState(true);

    // Bookmarks view toggle (optional feature)
    const [viewingBookmarks, setViewingBookmarks] = useState(false);
    const [bookmarkedMessages, setBookmarkedMessages] = useState<Message[]>([]);

    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Initial load: fetch threads
    useEffect(() => {
        loadThreads();
    }, []);

    // Fetch messages when thread changes
    useEffect(() => {
        if (activeThreadId && !viewingBookmarks) {
            loadMessages(activeThreadId);
        }
    }, [activeThreadId, viewingBookmarks]);

    // Auto-scroll
    useEffect(() => {
        if (!viewingBookmarks) {
            scrollRef.current?.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: 'smooth',
            });
        }
    }, [messages, viewingBookmarks]);

    const loadThreads = async () => {
        setIsFetchingThreads(true);
        try {
            const res = await fetch('/api/ai/threads');
            if (res.ok) {
                const data = await res.json();
                setThreads(data.threads || []);
                if (data.threads?.length > 0 && !activeThreadId) {
                    setActiveThreadId(data.threads[0].id);
                }
            }
        } catch (error) {
            console.error('Failed to load threads');
        } finally {
            setIsFetchingThreads(false);
        }
    };

    const loadMessages = async (threadId: string) => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/ai/threads/${threadId}`);
            if (res.ok) {
                const data = await res.json();
                setMessages(
                    (data.messages || []).map((m: any) => ({
                        id: m.id,
                        role: m.role,
                        content: m.content,
                        timestamp: new Date(m.created_at),
                        is_bookmarked: m.is_bookmarked
                    }))
                );
            }
        } catch (error) {
            console.error('Failed to load messages');
        } finally {
            setIsLoading(false);
        }
    };

    const createNewThread = async (firstMessage?: string) => {
        try {
            const res = await fetch('/api/ai/threads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ first_message: firstMessage || '' })
            });
            if (res.ok) {
                const data = await res.json();
                setThreads([data.thread, ...threads]);
                setActiveThreadId(data.thread.id);
                setMessages([]);
                setViewingBookmarks(false);
                return data.thread.id;
            }
        } catch (error) {
            toast.error('Failed to create new conversation');
        }
        return null;
    };

    const deleteThread = async (threadId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const res = await fetch(`/api/ai/threads/${threadId}`, { method: 'DELETE' });
            if (res.ok) {
                const newThreads = threads.filter(t => t.id !== threadId);
                setThreads(newThreads);
                if (activeThreadId === threadId) {
                    setActiveThreadId(newThreads.length > 0 ? newThreads[0].id : null);
                    if (newThreads.length === 0) setMessages([]);
                }
                toast.success('Conversation deleted');
            }
        } catch (error) {
            toast.error('Failed to delete conversation');
        }
    };

    const loadBookmarks = async () => {
        setIsLoading(true);
        setViewingBookmarks(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase
                .from('ai_conversations')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_bookmarked', true)
                .order('created_at', { ascending: false });

            setBookmarkedMessages((data || []).map((m: any) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                timestamp: new Date(m.created_at),
                is_bookmarked: true
            })));
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleBookmark = async (msgId: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('ai_conversations')
                .update({ is_bookmarked: !currentStatus })
                .eq('id', msgId);

            if (!error) {
                // Update local state
                setMessages(messages.map(m => m.id === msgId ? { ...m, is_bookmarked: !currentStatus } : m));
                if (viewingBookmarks) {
                    setBookmarkedMessages(bookmarkedMessages.filter(m => m.id !== msgId));
                }
            }
        } catch (error) {
            toast.error('Failed to update bookmark');
        }
    };

    const sendMessage = async (overrideText?: string) => {
        const textToSend = overrideText || input;
        if (!textToSend.trim() || isLoading) return;

        let currentThreadId = activeThreadId;

        // If no active thread (empty state), create one first
        if (!currentThreadId) {
            currentThreadId = await createNewThread(textToSend.trim());
            if (!currentThreadId) return;
        }

        const userMessage: Message = {
            id: crypto.randomUUID(), // Temp ID
            role: 'user',
            content: textToSend.trim(),
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        if (!overrideText) setInput('');
        setIsLoading(true);
        setViewingBookmarks(false);

        try {
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMessage.content, thread_id: currentThreadId }),
            });

            if (!res.ok) throw new Error('Failed to get response');

            const data = await res.json();

            const assistantMessage: Message = {
                id: crypto.randomUUID(), // Temp ID, gets replaced on reload
                role: 'assistant',
                content: data.response,
                timestamp: new Date(),
                is_bookmarked: false
            };

            setMessages((prev) => [...prev, assistantMessage]);

            // Refresh threads to update last_message_at and title
            loadThreads();

        } catch {
            toast.error('Failed to get AI response. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // Component for rendering a single message bubble
    const MessageBubble = ({ msg }: { msg: Message }) => (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className={cn(
                'flex gap-3 relative group',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
            )}
        >
            {msg.role === 'assistant' && (
                <div className="flex flex-col items-center gap-2">
                    <Avatar className="w-8 h-8 flex-shrink-0 mt-1 ring-1 ring-primary/10">
                        <AvatarFallback className="bg-gradient-to-br from-primary/15 to-primary/5 text-primary text-[10px] font-bold">
                            AI
                        </AvatarFallback>
                    </Avatar>
                    {/* Bookmark Toggle */}
                    <button
                        onClick={() => toggleBookmark(msg.id, !!msg.is_bookmarked)}
                        className={cn(
                            "opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-secondary",
                            msg.is_bookmarked && "opacity-100 text-amber-500"
                        )}
                        title={msg.is_bookmarked ? "Remove Bookmark" : "Save Response"}
                    >
                        {msg.is_bookmarked ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                    </button>
                </div>
            )}

            <div
                className={cn(
                    'max-w-[85%] sm:max-w-[75%] rounded-2xl text-sm leading-relaxed relative',
                    msg.role === 'user'
                        ? 'bg-primary text-primary-foreground px-4 py-3 rounded-br-sm'
                        : 'bg-secondary/80 text-foreground px-4 py-3 rounded-bl-sm border border-border/40'
                )}
            >
                {msg.role === 'assistant' ? (
                    <div className="prose-chat">
                        <ReactMarkdown
                            components={{
                                h1: ({ children }) => <h3 className="text-base font-bold mt-3 mb-1.5 first:mt-0">{children}</h3>,
                                h2: ({ children }) => <h4 className="text-sm font-bold mt-2.5 mb-1 first:mt-0">{children}</h4>,
                                h3: ({ children }) => <h5 className="text-sm font-semibold mt-2 mb-1 first:mt-0">{children}</h5>,
                                p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                                strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
                                em: ({ children }) => <em className="italic text-primary/90">{children}</em>,
                                ul: ({ children }) => <ul className="mb-2 last:mb-0 space-y-1 ml-1">{children}</ul>,
                                ol: ({ children }) => <ol className="mb-2 last:mb-0 space-y-1 ml-1 list-decimal list-inside">{children}</ol>,
                                li: ({ children }) => (
                                    <li className="flex items-start gap-2 text-sm">
                                        <span className="text-primary mt-0.5 flex-shrink-0">•</span>
                                        <span>{children}</span>
                                    </li>
                                ),
                                code: ({ children }) => (
                                    <code className="bg-background/50 text-xs px-1.5 py-0.5 rounded font-mono">{children}</code>
                                ),
                                blockquote: ({ children }) => (
                                    <blockquote className="border-l-2 border-primary/30 pl-3 my-2 italic text-muted-foreground">
                                        {children}
                                    </blockquote>
                                ),
                            }}
                        >
                            {msg.content}
                        </ReactMarkdown>
                    </div>
                ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
                <p
                    className={cn(
                        'text-[10px] mt-2 opacity-50',
                        msg.role === 'user' ? 'text-right' : 'text-left'
                    )}
                >
                    {msg.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                    })}
                </p>
            </div>
        </motion.div>
    );

    return (
        <div className="flex flex-col md:flex-row h-[calc(100vh-140px)] min-h-[500px] border rounded-xl overflow-hidden bg-card shadow-sm">

            {/* Sidebar (Threads & Bookmarks) */}
            <div className="w-full md:w-72 border-b md:border-b-0 md:border-r bg-secondary/10 flex flex-col flex-shrink-0">
                <div className="p-4 border-b">
                    <Button
                        onClick={() => createNewThread()}
                        className="w-full gap-2 font-medium"
                        variant="default"
                    >
                        <Plus size={16} /> New Conversation
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto w-full p-2 space-y-1">
                    <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Recent Conversations
                    </div>
                    {isFetchingThreads ? (
                        <div className="flex justify-center py-4"><Loader2 className="animate-spin w-4 h-4 text-muted-foreground" /></div>
                    ) : threads.length === 0 ? (
                        <div className="px-3 py-4 text-xs text-muted-foreground text-center">No past conversations</div>
                    ) : (
                        threads.map(thread => (
                            <div
                                key={thread.id}
                                onClick={() => { setActiveThreadId(thread.id); setViewingBookmarks(false); }}
                                className={cn(
                                    "px-3 py-2.5 rounded-lg cursor-pointer flex items-center justify-between group transition-colors",
                                    activeThreadId === thread.id && !viewingBookmarks ? "bg-primary/10 text-primary" : "hover:bg-secondary/40 text-foreground"
                                )}
                            >
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <MessageSquare size={14} className={activeThreadId === thread.id && !viewingBookmarks ? "text-primary" : "text-muted-foreground"} />
                                    <span className="text-sm truncate w-full">{thread.title}</span>
                                </div>
                                <button
                                    onClick={(e) => deleteThread(thread.id, e)}
                                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-opacity"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-2 border-t mt-auto">
                    <Button
                        onClick={loadBookmarks}
                        variant={viewingBookmarks ? "secondary" : "ghost"}
                        className={cn("w-full justify-start gap-2", viewingBookmarks && "bg-secondary/80")}
                    >
                        <Bookmark size={16} className={viewingBookmarks ? "text-amber-500 fill-amber-500/20" : ""} />
                        Saved Responses
                    </Button>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-background relative">
                <CardHeader className="pb-3 border-b flex-shrink-0 bg-gradient-to-r from-primary/5 to-transparent px-4 md:px-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10">
                            <Sparkles size={20} className="text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-base font-semibold">{viewingBookmarks ? 'Saved Responses' : 'AI Spiritual Guide'}</CardTitle>
                            <p className="text-xs text-muted-foreground">
                                {viewingBookmarks ? 'Your bookmarked insights' : (role === 'salik' ? 'Bismillah – seek guidance on your spiritual journey' : 'Bismillah – AI Assistant for Mentorship & Guidance')}
                            </p>
                        </div>
                    </div>
                </CardHeader>

                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Messages Area */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                        {viewingBookmarks ? (
                            <div className="space-y-6">
                                {bookmarkedMessages.length === 0 && !isLoading && (
                                    <div className="text-center py-20 text-muted-foreground">
                                        <Bookmark className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                        <p>No saved responses yet.</p>
                                    </div>
                                )}
                                {bookmarkedMessages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
                            </div>
                        ) : (
                            <>
                                {messages.length === 0 && !isLoading && (
                                    <div className="flex flex-col items-center justify-center h-full text-center px-4 max-w-2xl mx-auto">
                                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center mb-5 border border-primary/10">
                                            <BookOpen size={28} className="text-primary" />
                                        </div>
                                        <h3 className="text-xl font-medium mb-2">بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</h3>
                                        <p className="text-sm text-foreground/80 mb-6 leading-relaxed">
                                            {role === 'salik'
                                                ? "I'm your AI spiritual companion. I can see your Chilla progress and habit consistency. Ask me for guidance, encouragement, or ways to strengthen your daily amal."
                                                : "I'm your AI mentorship advisor. I have access to your assigned Saliks' data. Ask me for advice on supporting them, drafting messages, or analyzing their trends."
                                            }
                                        </p>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                                            {suggestions.map((suggestion) => (
                                                <button
                                                    key={suggestion}
                                                    onClick={() => sendMessage(suggestion)}
                                                    className="text-left text-sm px-4 py-3 rounded-xl bg-secondary/50 text-foreground hover:bg-primary/10 transition-colors border shadow-sm flex items-center gap-2"
                                                >
                                                    <span className="text-primary/70">✨</span>
                                                    <span>{suggestion}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <AnimatePresence>
                                    {messages.map((msg) => (
                                        <MessageBubble key={msg.id} msg={msg} />
                                    ))}
                                </AnimatePresence>

                                {/* Typing indicator */}
                                {isLoading && !viewingBookmarks && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="flex items-center gap-3"
                                    >
                                        <Avatar className="w-8 h-8 flex-shrink-0 ring-1 ring-primary/10">
                                            <AvatarFallback className="bg-gradient-to-br from-primary/15 to-primary/5 text-primary text-[10px] font-bold">
                                                AI
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="bg-secondary/80 rounded-2xl rounded-bl-sm px-4 py-4 border border-border/40">
                                            <div className="flex gap-1.5">
                                                {[0, 1, 2].map((i) => (
                                                    <motion.div
                                                        key={i}
                                                        className="w-2 h-2 rounded-full bg-primary/40"
                                                        animate={{ y: [0, -6, 0] }}
                                                        transition={{
                                                            duration: 0.6,
                                                            repeat: Infinity,
                                                            delay: i * 0.15,
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Input Area */}
                    {!viewingBookmarks && (
                        <div className="border-t bg-background p-3 sm:p-4 flex-shrink-0">
                            <div className="max-w-4xl mx-auto relative flex items-end gap-2 bg-secondary/30 border border-border/60 rounded-xl p-1 focus-within:border-primary/50 focus-within:bg-secondary/50 transition-colors shadow-sm">
                                <Textarea
                                    ref={textareaRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Message your guide... (Press Enter to send)"
                                    className="min-h-[44px] max-h-[160px] resize-none border-0 bg-transparent focus-visible:ring-0 shadow-none text-sm py-3 px-3"
                                    rows={1}
                                />
                                <div className="p-1">
                                    <Button
                                        onClick={() => sendMessage()}
                                        size="icon"
                                        disabled={!input.trim() || isLoading}
                                        className="h-9 w-9 rounded-lg flex-shrink-0 shadow-sm transition-all"
                                    >
                                        {isLoading ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : (
                                            <Send size={16} className="ml-0.5" />
                                        )}
                                    </Button>
                                </div>
                            </div>
                            <p className="text-[10px] text-muted-foreground/60 mt-2 text-center max-w-xl mx-auto">
                                HabiGuide offers personalized spiritual mentorship context. It does not replace human Murrabis or qualified Islamic scholars.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
