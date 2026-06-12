import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: object) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { title, content, location_name, template_name, time_of_day } = await req.json();

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return json({ tags: [] });

    const parts: string[] = [];
    if (title) parts.push(`Title: ${title}`);
    if (template_name) parts.push(`Category: ${template_name}`);
    if (content) parts.push(`Notes: ${content.substring(0, 800)}`);
    if (location_name) parts.push(`Location: ${location_name}`);
    if (time_of_day) parts.push(`Time of day: ${time_of_day}`);

    if (parts.length === 0) return json({ tags: [] });

    const prompt = `Based on this journal entry, suggest 3–5 short, specific, lowercase tags. Return ONLY a JSON array of strings with no explanation, e.g. ["italian food", "date night", "wilmington"].\n\n${parts.join('\n')}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) return json({ tags: [] });

    const data = await response.json();
    const text = (data.content?.[0]?.text ?? '').trim();

    const match = text.match(/\[[\s\S]*?\]/);
    const parsed = match ? JSON.parse(match[0]) : [];
    const tags = Array.isArray(parsed)
      ? parsed
          .filter((t: unknown) => typeof t === 'string')
          .map((t: string) => t.toLowerCase().trim())
          .filter(Boolean)
      : [];

    return json({ tags });
  } catch {
    return json({ tags: [] });
  }
});
