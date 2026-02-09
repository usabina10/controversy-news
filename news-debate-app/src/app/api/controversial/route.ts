iimport { NextResponse } from 'next/server';

const SOURCES = [
  process.env.TG_RSS_1!,
  process.env.TG_RSS_2!,
  'https://www.ynet.co.il/Integration/StoryRss2.xml'
];

export async function GET() {
  try {
    // RSS fetch
    const rssData = await Promise.all(SOURCES.map(async (url) => {
      const res = await fetch(url);
      return res.ok ? await res.text() : '';
    })).catch(() => []);

    // OpenRouter analyze
    const analysis = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://controversy-news.vercel.app',
        'X-Title': 'Controversy News'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.1-70b-instruct:free',
        messages: [{
          role: 'user',
          content: `נתח ידיעות ישראליות מ-RSS: ${SOURCES.slice(0,2).join(', ')}
          רק controversial פוליטיות. TOP 3 JSON:
          {events: [{id, title, controversial: boolean, facts: string[], right: string, left: string}]}`
        }]
      })
    });

    const result = await analysis.json();
    
    // Parse AI JSON (safe)
    let events = [];
    try {
      const content = result.choices?.[0]?.message?.content || '';
      events = JSON.parse(content.match(/\{.*\}/s)?.[0] || '[]');
    } catch {
      events = [{ id: 1, title: "🧪 RSS + AI test", controversial: true }];
    }

    return NextResponse.json({ events });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ events: [], error: error.message || 'Unknown error' });
  }
}
