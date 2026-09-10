import { createClient } from 'npm:@supabase/supabase-js@2.103.0';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};
const respond = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return respond(405, { error: 'Method not allowed' });
  const token = request.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return respond(401, { error: 'Authentication required' });
  try {
    const body = await request.json();
    if (body.confirmation !== 'SUPPRIMER') return respond(400, { error: 'Explicit confirmation required' });
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    // Verify with Auth, never trust a client-supplied ID or a decoded JWT alone.
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return respond(401, { error: 'Invalid session' });
    const { data: protectedPortfolio, error: checkError } = await admin.from('portfolios').select('id').eq('user_id', user.id).eq('slug', 'teryso').maybeSingle();
    if (checkError) throw checkError;
    if (protectedPortfolio) return respond(409, { error: 'Contact support to transfer the protected community portfolio before deleting this account.' });

    // Revoke refresh sessions before cleanup. No privileged key reaches Expo.
    const { error: signOutError } = await admin.auth.admin.signOut(token, 'global');
    if (signOutError) throw signOutError;
    // Use Storage API, never DELETE storage.objects directly. Bounded batches
    // allow a failed/large deletion to be retried without falsely reporting success.
    for (let batch = 0; batch < 100; batch++) {
      const { data: files, error } = await admin.rpc('account_deletion_files', { p_user_id: user.id });
      if (error) throw error;
      if (!Array.isArray(files)) throw new Error('Invalid storage manifest');
      if (!files.length) {
        // The auth.users BEFORE DELETE trigger cleans relational data atomically.
        const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
        if (deleteError) throw deleteError;
        return respond(200, { deleted: true });
      }
      const buckets = new Map<string, string[]>();
      for (const file of files) {
        const paths = buckets.get(file.bucket_id) ?? [];
        paths.push(file.name); buckets.set(file.bucket_id, paths);
      }
      for (const [bucket, paths] of buckets) {
        const { error: storageError } = await admin.storage.from(bucket).remove(paths);
        if (storageError) throw storageError;
      }
    }
    return respond(409, { error: 'Cleanup is incomplete. Sign in again and retry, or contact support.' });
  } catch {
    return respond(500, { error: 'Deletion not completed. Retry or contact contact@teryso.com.' });
  }
});
