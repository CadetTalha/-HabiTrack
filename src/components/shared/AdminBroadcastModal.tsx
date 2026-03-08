'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Megaphone, Loader2 } from 'lucide-react';

export function AdminBroadcastModal() {
    const [mounted, setMounted] = useState(false);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [target, setTarget] = useState('all');
    const [specificUserId, setSpecificUserId] = useState('');

    const handleSend = async () => {
        if (!title.trim() || !message.trim()) {
            toast.error('Title and message are required.');
            return;
        }

        if (target === 'specific' && !specificUserId.trim()) {
            toast.error('User ID is required for specific target.');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch('/api/admin/broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    message,
                    target,
                    specificUserId: target === 'specific' ? specificUserId : undefined
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to send broadcast');
            }

            toast.success('Broadcast sent successfully!');
            setOpen(false);

            // Reset state
            setTitle('');
            setMessage('');
            setTarget('all');
            setSpecificUserId('');
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!mounted) {
        return (
            <Button variant="secondary" className="gap-2 shrink-0 opacity-50 cursor-not-allowed">
                <Megaphone size={16} />
                Send Announcement
            </Button>
        );
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="secondary" className="gap-2 shrink-0">
                    <Megaphone size={16} />
                    Send Announcement
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Send Broadcast</DialogTitle>
                    <DialogDescription>
                        Send a system-wide notification to selected users.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="target">Target Audience</Label>
                        <Select value={target} onValueChange={setTarget}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select target" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Users</SelectItem>
                                <SelectItem value="saliks">All Saliks</SelectItem>
                                <SelectItem value="murabbis">All Murabbis</SelectItem>
                                <SelectItem value="specific">Specific User</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {target === 'specific' && (
                        <div className="grid gap-2">
                            <Label htmlFor="userId">User ID</Label>
                            <Input
                                id="userId"
                                placeholder="Enter specific user's UUID"
                                value={specificUserId}
                                onChange={(e) => setSpecificUserId(e.target.value)}
                            />
                        </div>
                    )}

                    <div className="grid gap-2">
                        <Label htmlFor="title">Notification Title</Label>
                        <Input
                            id="title"
                            placeholder="e.g., Scheduled Maintenance"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="message">Message Body</Label>
                        <Textarea
                            id="message"
                            placeholder="Type your announcement here..."
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={4}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSend} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Send Now
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
