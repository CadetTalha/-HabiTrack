// ════════════════════════════════════════════════════════════
// Messages Page – Central Messaging Hub
// ════════════════════════════════════════════════════════════
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { ChatModule } from '@/components/shared/ChatModule';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Users, ShieldAlert, MessageSquare, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Contact {
    id: string;
    full_name: string;
    role: string;
    avatar_url?: string;
}

export default function MessagesPage() {
    const { profile, loading: authLoading } = useAuth();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [selectedUser, setSelectedUser] = useState<Contact | null>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const supabase = createClient();

    useEffect(() => {
        if (!profile) return;

        const fetchContacts = async () => {
            setLoading(true);
            try {
                if (profile.role === 'salik') {
                    // Salik: Contact is their assigned Murrabi
                    const { data: map } = await supabase
                        .from('salik_murabbi_map')
                        .select('profiles!murabbi_id(id, full_name, role, avatar_url)')
                        .eq('salik_id', profile.id)
                        .eq('is_active', true)
                        .single();

                    if (map?.profiles) {
                        const m = map.profiles as any;
                        const contact = { id: m.id, full_name: m.full_name, role: m.role, avatar_url: m.avatar_url };
                        setContacts([contact]);
                        setSelectedUser(contact);
                    }
                } else if (profile.role === 'murabbi') {
                    // Murrabi: Contacts are their assigned Saliks + Admins
                    const { data: saliks } = await supabase
                        .from('salik_murabbi_map')
                        .select('profiles!salik_id(id, full_name, role, avatar_url)')
                        .eq('murabbi_id', profile.id)
                        .eq('is_active', true);

                    const { data: admins } = await supabase
                        .from('profiles')
                        .select('id, full_name, role, avatar_url')
                        .eq('role', 'admin');

                    const mappedSaliks = (saliks || []).map((s: any) => s.profiles);
                    setContacts([...(admins || []), ...mappedSaliks]);
                } else if (profile.role === 'admin') {
                    // Admin: Anyone (Searchable)
                    const { data: everyone } = await supabase
                        .from('profiles')
                        .select('id, full_name, role, avatar_url')
                        .neq('id', profile.id)
                        .limit(50); // Start with some, then search

                    setContacts(everyone || []);
                }
            } catch (error) {
                console.error('Error fetching contacts:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchContacts();
    }, [profile, supabase]);

    const filteredContacts = contacts.filter(c =>
        c.full_name.toLowerCase().includes(search.toLowerCase())
    );

    if (authLoading || loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!profile) return null;

    return (
        <div className="flex h-[calc(100vh-140px)] gap-6 max-w-6xl mx-auto overflow-hidden">
            {/* ── Sidebar (Contact List) ── */}
            {profile.role !== 'salik' && (
                <div className="w-80 flex flex-col gap-4 shrink-0 overflow-hidden">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                        <Input
                            placeholder="Search contacts..."
                            className="pl-10 rounded-xl bg-card/40 border-white/20"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <Card className="flex-1 border border-white/20 dark:border-white/5 shadow-xl glass-panel bg-card/40 overflow-hidden">
                        <CardContent className="p-0 h-full overflow-y-auto custom-scrollbar">
                            <div className="p-3 border-b border-white/10 flex items-center gap-2">
                                <Users size={16} className="text-primary" />
                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contacts</span>
                            </div>
                            {filteredContacts.length === 0 ? (
                                <div className="p-10 text-center space-y-2">
                                    <ShieldAlert size={32} className="mx-auto text-muted-foreground opacity-20" />
                                    <p className="text-xs text-muted-foreground">No contacts found.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-white/5">
                                    {filteredContacts.map(contact => (
                                        <button
                                            key={contact.id}
                                            onClick={() => setSelectedUser(contact)}
                                            className={`w-full flex items-center gap-3 p-4 text-left transition-all hover:bg-primary/5 ${selectedUser?.id === contact.id ? 'bg-primary/10 border-l-4 border-primary' : ''}`}
                                        >
                                            <Avatar className="h-10 w-10 border border-primary/20">
                                                <AvatarImage src={contact.avatar_url} />
                                                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                                                    {contact.full_name.charAt(0)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-bold truncate ${selectedUser?.id === contact.id ? 'text-primary' : ''}`}>
                                                    {contact.full_name}
                                                </p>
                                                <p className="text-[10px] text-muted-foreground uppercase">{contact.role}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* ── Chat Area ── */}
            <div className="flex-1 overflow-hidden">
                {selectedUser ? (
                    <ChatModule targetUser={selectedUser} currentUserId={profile.id} />
                ) : (
                    <Card className="h-full flex flex-col items-center justify-center border border-white/20 dark:border-white/5 shadow-xl glass-panel bg-card/40 p-10 text-center">
                        <div className="w-20 h-20 rounded-3xl bg-primary/5 flex items-center justify-center text-primary/20 mb-6">
                            <MessageSquare size={40} />
                        </div>
                        <h2 className="text-xl font-bold mb-2">Direct Messaging</h2>
                        <p className="text-sm text-muted-foreground max-w-sm">
                            {profile.role === 'salik'
                                ? "Initializing conversation with your Murrabi..."
                                : "Select a contact from the list to start messaging."
                            }
                        </p>
                    </Card>
                )}
            </div>
        </div>
    );
}
