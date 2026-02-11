import { fetchHotNews } from '../../../lib/rss';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const newsItems = await fetchHotNews();
    
    if (!newsItems.length) {
      return NextResponse.json({ events: [] });
    }

    // OpenRouter bias split
    const openrouter = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.1-70b-instruct:free',
        messages: [{
          role: 'user',
          content: `חדשות: ${newsItems.map(n => n.title).join('\\n')}
פרקנויות שנויות במחלוקת JSON: {
  "events": [{
    "title": "[כותרת חדשות]",
    "right": "פרשנות ימנית (ישראל היום סגנון)",
    "left": "פרשנות שמאלנית (הארץ סגנון)", 
    "controversial": true,
    "sources": ["ynet", "ישראל היום"]
  }]
}`
        }]
      })
    });

    const result = await openrouter.json();
    const aiEvents = JSON.parse(result.choices?.[0]?.message?.content || '[]');
    
    return NextResponse.json({ events: aiEvents.length ? aiEvents.events || aiEvents : newsItems.map(item => ({
      id: item.guid,
      title: item.title,  // ← Fixed: Added item.title
      right: "פרשנות ימנית",
      left: "פרשנות שמאלנית", 
      sources: ["RSS fallback"],
      controversial: true
    })) });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ 
      events: [{
        title: "🚧 טוען חדשות שנויות במחלוקת...",
        right: "טוען ימין...",
        left: "טוען שמאל...", 
        sources: ["debug"]
      }]
    });
  }
}
