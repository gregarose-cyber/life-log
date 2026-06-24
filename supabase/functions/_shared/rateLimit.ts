import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DAILY_LIMIT = 40;

export async function checkRateLimit(req: Request): Promise<{ allowed: boolean }> {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return { allowed: false };

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: { user } } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (!user) return { allowed: false };

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const { count } = await supabase
      .from('api_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('called_at', startOfDay.toISOString());

    if ((count ?? 0) >= DAILY_LIMIT) return { allowed: false };

    await supabase.from('api_usage').insert({ user_id: user.id });

    return { allowed: true };
  } catch {
    return { allowed: true }; // fail open — don't block on rate limit errors
  }
}
