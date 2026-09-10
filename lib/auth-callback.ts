import { supabase } from './supabase';

// A native callback can reach both WebBrowser and Expo Router. Exchange once.
const exchanges = new Map<string, Promise<void>>();
export function exchangeAuthCode(code: string) {
  const existing = exchanges.get(code);
  if (existing) return existing;
  const pending = (async () => {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
  })();
  exchanges.set(code, pending);
  if (exchanges.size > 8) exchanges.delete(exchanges.keys().next().value!);
  return pending;
}
