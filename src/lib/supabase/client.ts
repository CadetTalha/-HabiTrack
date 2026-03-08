// ════════════════════════════════════════════════════════════
// Supabase Browser Client (for Client Components)
// ════════════════════════════════════════════════════════════
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | undefined;

/**
 * Singleton Browser Client (for Client Components)
 * Reuses the same instance to prevent multiple auth storage locks
 */
export function createClient() {
    if (client) return client;

    client = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'
    );

    return client;
}
