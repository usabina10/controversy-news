import { NextResponse } from 'next/server';

const SOURCES = [
  'https://www.ynet.co.il/Integration/StoryRss2.xml',
  process.env.TG_CHANNEL_RSS || ''
];

export async function GET() {
  try {
    // RSS fetch
    const rss = await fetch(SOURCES[0]);
    const xml = await rss.text();
    
    // OpenRouter controversial analysis
    const openrouter = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://controversy-news.vercel.app'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.1-70b-instruct:free',
        messages: [{
          role: 'user',
          content: `מהחדשות האחרונות בעברית: ${xml.slice(0,2000)}
תן TOP 3 controversial ישראליות JSON:
{"events": [{"title":"...", "controversial":true, "right":"...", "left":"..."}]}`
        }]
      })
    });
    
    const result = await openrouter.json();
    const events = JSON.parse(result.choices[0].message.content || '[]');
    
    return NextResponse.json({ events });
  } catch (error) {
    return NextResponse.json({
      events: [{
        title: "🔄 RSS loading...",
        controversial: true,
        right: "טוען...",
        left: "טוען..."
      }]
    });
  }
}
