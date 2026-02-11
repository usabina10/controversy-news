import { getControversySources } from '@/lib/rss'; // RSS שלך!
import { OPENROUTER_KEY } from '@/lib/env'; // env.local
import { NextResponse } from 'next/server';

export async function GET() {
  const sources = await getControversySources();
  
  // RSS fetch + OpenRouter
  const rssTexts = await Promise.all(
    sources.slice(0,3).map(s => fetch(s.url).then(r => r.text()))
  );
  
  const openrouter = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.1-70b-instruct:free',
      messages: [{
        role: 'user',
        content: `חדשות ישראליות מ-${sources.map(s=>s.name).join(', ')}: ${rssTexts.join('\n')}
        TOP 3 controversial JSON: {events: [{title, right, left}]}`
      }]
    })
  });
  
  const result = await openrouter.json();
  return NextResponse.json({ events: result.choices[0]?.message?.content });
}
