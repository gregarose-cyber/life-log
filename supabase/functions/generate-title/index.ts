import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { allowed } = await checkRateLimit(req);
    if (!allowed) {
      return new Response(JSON.stringify({ title: '' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { content, location_name, tags, time_of_day, template_name, template_fields } =
      await req.json();

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ title: '' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const parts: string[] = [];
    if (content) parts.push(`Notes: ${content.substring(0, 600)}`);
    if (template_name) parts.push(`Category: ${template_name}`);
    if (template_fields) parts.push(`Details: ${template_fields}`);
    if (location_name) parts.push(`Location: ${location_name}`);
    if (tags?.length) parts.push(`Tags: ${tags.join(', ')}`);
    if (time_of_day) parts.push(`Time of day: ${time_of_day}`);

    if (parts.length === 0) {
      return new Response(JSON.stringify({ title: '' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prompt = `Based on this journal entry, generate a specific, descriptive title of 4–8 words. Return ONLY the title — no quotes, no punctuation at the end, no explanation.\n\n${parts.join('\n')}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 30,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ title: '' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const title = (data.content?.[0]?.text ?? '').trim();

    return new Response(JSON.stringify({ title }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ title: '' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
