// ════════════════════════════════════════════════════════════
// Murabbi – AI Mentorship Assistant Page
// ════════════════════════════════════════════════════════════
import { ChatInterface } from '@/components/shared/ChatInterface';
import { Sparkles } from 'lucide-react';

export default function MurabbiChatPage() {
    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="bg-card p-6 rounded-xl border shadow-sm">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Sparkles className="text-primary" />
                    Mentorship Copilot
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Ask for guidance on how to support your Saliks effectively.
                </p>
            </div>
            <div className="bg-card rounded-xl border shadow-sm overflow-hidden h-[700px]">
                <ChatInterface />
            </div>
        </div>
    );
}
