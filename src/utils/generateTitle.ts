import { supabase } from '@/lib/supabase';

interface GenerateTitleParams {
  content?: string | null;
  location_name?: string | null;
  tags?: string[];
  time_of_day?: string | null;
  template_name?: string;
  template_fields?: string;
}

export async function generateTitle(params: GenerateTitleParams): Promise<string> {
  try {
    const raceResult = await Promise.race([
      supabase.functions.invoke('generate-title', { body: params }),
      new Promise<{ data: null; error: Error }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error('timeout') }), 8000)
      ),
    ]);
    return (raceResult.data?.title as string) ?? '';
  } catch {
    return '';
  }
}
