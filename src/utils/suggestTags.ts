import { supabase } from '@/lib/supabase';

interface ApplySuggestedTagsParams {
  entryId: string;
  userId: string;
  title?: string | null;
  content?: string | null;
  location_name?: string | null;
  template_name?: string | null;
  time_of_day?: string | null;
}

const TAG_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#06b6d4'];

function tagColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return TAG_COLORS[Math.abs(h) % TAG_COLORS.length];
}

export async function applySuggestedTags(params: ApplySuggestedTagsParams): Promise<void> {
  try {
    const { data } = await supabase.functions.invoke('suggest-tags', {
      body: {
        title: params.title,
        content: params.content,
        location_name: params.location_name,
        template_name: params.template_name,
        time_of_day: params.time_of_day,
      },
    });

    const suggested: string[] = Array.isArray(data?.tags) ? data.tags : [];
    if (suggested.length === 0) return;

    for (const name of suggested) {
      const { data: existing } = await supabase
        .from('tags')
        .select('id')
        .eq('user_id', params.userId)
        .eq('name', name)
        .maybeSingle();

      let tagId: string | undefined = existing?.id;

      if (!tagId) {
        const { data: created } = await supabase
          .from('tags')
          .insert({ user_id: params.userId, name, color: tagColor(name) })
          .select('id')
          .single();
        tagId = created?.id;
      }

      if (!tagId) continue;

      const { data: linked } = await supabase
        .from('entry_tags')
        .select('entry_id')
        .eq('entry_id', params.entryId)
        .eq('tag_id', tagId)
        .maybeSingle();

      if (!linked) {
        await supabase.from('entry_tags').insert({ entry_id: params.entryId, tag_id: tagId });
      }
    }
  } catch {
    // silent failure — entry is already saved
  }
}
