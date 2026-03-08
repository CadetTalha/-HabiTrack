// ════════════════════════════════════════════════════════════
// ChatModule – Reusable 1:1 Messaging Component
// ════════════════════════════════════════════════════════════
'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Send, MessageSquare, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Message {
    id: string;
    sender_id: string;
    receiver_id: string;
    content: string;
    created_at: string;
    sender: { full_name: string; avatar_url: string };
}

interface ChatModuleProps {
    targetUser: {
        id: string;
        full_name: string;
        avatar_url?: string;
        role?: string;
    };
    currentUserId: string;
}

export function ChatModule({ targetUser, currentUserId }: ChatModuleProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const supabase = createClient();

    // Fetch history & subscribe to real-time
    useEffect(() => {
        if (!targetUser.id) return;

        const fetchData = async () => {
            setLoading(true);
            const res = await fetch(`/api/messages?userId=${targetUser.id}`);
            if (res.ok) {
                const data = await res.json();
                setMessages(data);
            }
            setLoading(false);
            scrollToBottom();
        };

        fetchData();

        // Subscribe to NEW messages
        const channel = supabase
            .channel(`chat_${currentUserId}_${targetUser.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'direct_messages',
                    filter: `receiver_id=eq.${currentUserId}`
                },
                (payload) => {
                    const nm = payload.new as any;
                    // Only care if it's from the person we are chatting with
                    if (nm.sender_id !== targetUser.id) return;

                    const newMessage = {
                        ...nm,
                        sender: { full_name: targetUser.full_name, avatar_url: targetUser.avatar_url || '' }
                    } as Message;
                    setMessages((prev) => {
                        if (prev.some(m => m.id === newMessage.id)) return prev;
                        return [...prev, newMessage];
                    });
                    scrollToBottom();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [targetUser.id, currentUserId, supabase]);

    const scrollToBottom = () => {
        setTimeout(() => {
            if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
        }, 100);
    };

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || sending) return;

        setSending(true);
        try {
            const res = await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    receiver_id: targetUser.id,
                    content: input.trim()
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to send message');
            }

            const sentMessage = await res.json();
            // Append local one immediately (with profile info)
            setMessages((prev) => [...prev, {
                ...sentMessage,
                sender: { full_name: 'Me', avatar_url: '' } // Simplified for local append
            }]);

            setInput('');
            scrollToBottom();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setSending(false);
        }
    };

    return (
        <Card className="h-full flex flex-col border border-white/20 dark:border-white/5 shadow-xl glass-panel bg-card/40 overflow-hidden">
            <CardHeader className="bg-muted/30 border-b py-4">
                <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 border border-primary/20 shadow-sm">
                        <AvatarImage src={targetUser.avatar_url} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                            {targetUser.full_name?.charAt(0)}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <CardTitle className="text-sm font-bold">{targetUser.full_name}</CardTitle>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                            {targetUser.role || 'User'}
                        </p>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="flex-1 p-0 flex flex-col min-h-0 bg-background/20 overflow-hidden">
                <div
                    ref={scrollRef}
                    className="flex-1 p-4 overflow-y-auto custom-scrollbar h-[calc(100%-80px)]"
                >
                    {loading ? (
                        <div className="flex items-center justify-center h-40">
                            <Loader2 className="h-6 w-6 animate-spin text-primary opacity-50" />
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full py-10 text-center space-y-3">
                            <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary/30">
                                <MessageSquare size={24} />
                            </div>
                            <p className="text-xs text-muted-foreground max-w-[200px]">
                                No messages yet. Start your conversation below.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {messages.map((msg) => {
                                const isMe = msg.sender_id === currentUserId;
                                return (
                                    <div
                                        key={msg.id}
                                        className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`max-w-[80%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                            <div
                                                className={`px-4 py-2 rounded-2xl text-sm shadow-sm ${isMe
                                                    ? 'bg-primary text-white rounded-tr-none'
                                                    : 'bg-card border border-border/40 text-foreground rounded-tl-none'
                                                    }`}
                                            >
                                                {msg.content}
                                            </div>
                                            <span className="text-[10px] text-muted-foreground mt-1 px-1">
                                                {format(new Date(msg.created_at), 'h:mm a')}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="p-4 bg-muted/20 border-t border-border/40">
                    <form onSubmit={handleSend} className="flex items-center gap-2">
                        <Input
                            placeholder="Type a message..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            className="bg-background/50 border-white/20 rounded-xl text-sm"
                            disabled={sending}
                        />
                        <Button
                            type="submit"
                            size="icon"
                            disabled={!input.trim() || sending}
                            className={`rounded-xl shrink-0 ${input.trim() ? 'shadow-lg shadow-primary/20' : ''}`}
                        >
                            {sending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                        </Button>
                    </form>
                </div>
            </CardContent>
        </Card>
    );
}
