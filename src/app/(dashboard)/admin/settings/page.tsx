// ════════════════════════════════════════════════════════════
// Admin – System Settings Configuration
// ════════════════════════════════════════════════════════════
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Clock, Save, Loader2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function AdminSettingsPage() {
    const [settings, setSettings] = useState({
        reminder_time: '22:00:00',
        murrabi_alert_time: '22:30:00',
        performance_threshold: 65,
        consecutive_miss_threshold: 5
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/admin/settings');
            if (res.ok) {
                const data = await res.json();
                if (data.settings) {
                    setSettings(data.settings);
                }
            } else {
                toast.error('Failed to load system settings');
            }
        } catch (error) {
            console.error(error);
            toast.error('Network error loading settings');
        } finally {
            setLoading(false);
        }
    };

    const saveSettings = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reminder_time: settings.reminder_time.length === 5 ? `${settings.reminder_time}:00` : settings.reminder_time,
                    murrabi_alert_time: settings.murrabi_alert_time.length === 5 ? `${settings.murrabi_alert_time}:00` : settings.murrabi_alert_time,
                    performance_threshold: Number(settings.performance_threshold),
                    consecutive_miss_threshold: Number(settings.consecutive_miss_threshold),
                })
            });

            if (res.ok) {
                toast.success('Settings saved successfully!');
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to save settings');
            }
        } catch (error) {
            console.error(error);
            toast.error('Network error saving settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    // Format time for time input safely (remove seconds if present)
    const formatTimeForInput = (timeString: string) => {
        if (!timeString) return '00:00';
        return timeString.substring(0, 5);
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">System Configuration</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Administer global notification thresholds and cron schedules.
                </p>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="max-w-2xl space-y-6"
            >
                {/* 1. Time Settings Card */}
                <Card className="border-0 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <Clock size={18} className="text-primary" />
                            Cron Schedules (PKT)
                        </CardTitle>
                        <CardDescription>
                            Configure when automated reminder scripts execute.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid gap-2">
                            <Label htmlFor="reminder_time">Daily Report Reminder Time</Label>
                            <Input
                                id="reminder_time"
                                type="time"
                                value={formatTimeForInput(settings.reminder_time)}
                                onChange={(e) => setSettings({ ...settings, reminder_time: e.target.value })}
                                className="max-w-[200px]"
                            />
                            <p className="text-xs text-muted-foreground">
                                Notification sent to Saliks who haven't submitted their daily report.
                            </p>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="murrabi_alert_time">Murrabi Summary Alert Time</Label>
                            <Input
                                id="murrabi_alert_time"
                                type="time"
                                value={formatTimeForInput(settings.murrabi_alert_time)}
                                onChange={(e) => setSettings({ ...settings, murrabi_alert_time: e.target.value })}
                                className="max-w-[200px]"
                            />
                            <p className="text-xs text-muted-foreground">
                                Notification sent to Murrabi alerting them of inactive Saliks.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Threshold Settings Card */}
                <Card className="border-0 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <AlertTriangle size={18} className="text-amber-500" />
                            Performance Thresholds
                        </CardTitle>
                        <CardDescription>
                            Configure limits that trigger automatic concern notifications.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid gap-2">
                            <Label htmlFor="performance_threshold">Performance Drop Alert (%)</Label>
                            <div className="flex items-center gap-2 max-w-[200px]">
                                <Input
                                    id="performance_threshold"
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={settings.performance_threshold}
                                    onChange={(e) => setSettings({ ...settings, performance_threshold: parseInt(e.target.value) || 0 })}
                                />
                                <span className="text-sm font-medium">%</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                If a Salik's 7-day trailing average falls below this, both they and their Murrabi are alerted.
                            </p>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="consecutive_miss_threshold">Consecutive Miss Limit (Days)</Label>
                            <div className="flex items-center gap-2 max-w-[200px]">
                                <Input
                                    id="consecutive_miss_threshold"
                                    type="number"
                                    min="1"
                                    max="30"
                                    value={settings.consecutive_miss_threshold}
                                    onChange={(e) => setSettings({ ...settings, consecutive_miss_threshold: parseInt(e.target.value) || 0 })}
                                />
                                <span className="text-sm font-medium">days</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Threshold for triggering the 'AWOL' Murrabi alert.
                            </p>
                        </div>

                        <div className="pt-4 flex items-center justify-between">
                            <p className="text-xs flex items-center gap-1.5 text-sage">
                                <ShieldCheck size={14} />
                                All updates are automatically secured and logged.
                            </p>
                            <Button onClick={saveSettings} disabled={saving} className="gap-2">
                                {saving ? (
                                    <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
                                ) : (
                                    <><Save size={16} /> Save Configuration</>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}
