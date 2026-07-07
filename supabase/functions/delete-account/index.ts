import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Verify the user
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const userId = user.id;

    // Delete storage files
    const { data: files } = await supabaseAdmin.storage
      .from('entry-files')
      .list(userId, { limit: 1000 });

    if (files && files.length > 0) {
      // List files in each entry subfolder
      const allPaths: string[] = [];
      for (const folder of files) {
        const { data: subFiles } = await supabaseAdmin.storage
          .from('entry-files')
          .list(`${userId}/${folder.name}`, { limit: 1000 });
        if (subFiles) {
          subFiles.forEach(f => allPaths.push(`${userId}/${folder.name}/${f.name}`));
        }
      }
      if (allPaths.length > 0) {
        await supabaseAdmin.storage.from('entry-files').remove(allPaths);
      }
    }

    // Delete user data in dependency order
    const { data: entries } = await supabaseAdmin
      .from('entries')
      .select('id')
      .eq('user_id', userId);

    if (entries && entries.length > 0) {
      const entryIds = entries.map((e: any) => e.id);
      await supabaseAdmin.from('entry_photos').delete().in('entry_id', entryIds);
      await supabaseAdmin.from('entry_tags').delete().in('entry_id', entryIds);
      await supabaseAdmin.from('entry_links').delete().in('entry_id', entryIds);
    }

    await supabaseAdmin.from('entries').delete().eq('user_id', userId);
    await supabaseAdmin.from('tags').delete().eq('user_id', userId);
    await supabaseAdmin.from('api_usage').delete().eq('user_id', userId);

    // Delete the auth user
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? 'Unknown error' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
