import { fetchHotNews } from '@/lib/rss'; // RSS שלך!
import { OPENROUTER_KEY } from '@/lib/env';
import { NextResponse } from 'next/server';

export async function GET() {
  // 1. RSS שלך → NewsItem[]
  const newsItems = await fetchHotNews();
  
  if (newsItems.length === 0) {
    return NextResponse.json({ events: [] });
  }
  
  // 2. OpenRouter controversial analysis
  const newsText = newsItems.map(n => 
    `${n.title}\n${n.pubDate}\n${n.description.slice(0,500)}`
  ).join('\n\n');
  
  const openrouter = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://controversy-news.vercel.app'
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.1-70b-instruct:free',
      messages: [{
        role: 'user',
        content: `חדשות ישראליות חמות:\n${newsText}\n\nנתח ל-3 כרטיסי ויכוח:
        JSON: {"events": [{"title": "...", "right": "ישראל היום סטייל", "left": "הארץ סטייל", "sources": ["ynet"]}]}` 
      }]
    })
  });
  
  const result = await openrouter.json();
  let events = [];
  try {
    events = JSON.parse(result.choices[0]?.message?.content || '[]');
  } catch {
    // fallback ל-RSS גולמי
    events = newsItems.slice(0,3).map(item => ({
      title: item.title,
      right: "פרשנות ימנית",
      left: "פרשנות שמאלנית",
      sources: ["ynet", "israelhayom"]
    }));
  }
  
  return NextResponse.json({ events });
}
