import { fetchHotNews } from '../../../lib/rss';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const newsItems = await fetchHotNews();
    
    if (!newsItems.length) return NextResponse.json({ events: [] });

    const fallback = newsItems.slice(0,5).map(item => ({
      id: item.guid,
      title: item.title,
      right: "🟥 ימין: ניצחון נתניהו",
      left: "🟦 שמאל: סכנה", 
      sources: ["ynet", "טלגרם"],
      controversial: true
    }));

    if (!process.env.OPENROUTER_KEY) {
      return NextResponse.json({ events: fallback });
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://controversy-news.vercel.app/',
        'X-Title': 'News Debate'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.3-70b-instruct:free',  // ✓ 2026 free
        messages: [{
          role: 'user',
          content: `פרקנויות: ${newsItems.slice(0,2).map(n => n.title).join('; ')}
תוצאה JSON:
{"events":[{"title":"כותרת","right":"🟥 ימין","left":"🟦 שמאל","sources":["ynet"]}]}`
        }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('OpenRouter:', err);
      return NextResponse.json({ events: fallback });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    
    let events = fallback;
    try {
      const parsed = JSON.parse(content);
      if (parsed.events && Array.isArray(parsed.events)) {
        events = parsed.events;
      }
    } catch {}

    return NextResponse.json({ events });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ events: [{ title: "🚧 טוען AI..." }] });
  }
}