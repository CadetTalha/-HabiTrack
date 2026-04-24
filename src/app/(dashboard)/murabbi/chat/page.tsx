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
                <ChatInterface 
                    role="murabbi" 
                    suggestions={[
                        "How do I gently motivate a Salik who is missing prayers?", 
                        "What is a good way to encourage Quran reading?", 
                        "How do I address a sudden drop in daily adherence?", 
                        "What are some Prophetic tips for consistency?"
                    ]} 
                />
            </div>
        </div>
    );
}
