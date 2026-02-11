import { fetchHotNews } from '../../../lib/rss';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('🚀 API start');
    
    const newsItems = await fetchHotNews();
    console.log(`📊 Got ${newsItems.length} news items`);
    
    if (!newsItems.length) {
      return NextResponse.json({ events: [] });
    }

    console.log('🔑 OPENROUTER_KEY exists:', !!process.env.OPENROUTER_KEY);

    if (!process.env.OPENROUTER_KEY) {
      console.log('⚠️ No OpenRouter - RSS fallback');
      return NextResponse.json({ 
        events: newsItems.slice(0,5).map(item => ({
          id: item.guid,
          title: item.title,
          right: "פרשנות ימנית",
          left: "פרשנות שמאלנית", 
          sources: ["RSS"],
          controversial: true
        }))
      });
    }

    const prompt = `חדשות:
${newsItems.slice(0,3).map(n => n.title).join('\n')}

JSON בלבד:
{"events":[{
  "title": "${newsItems[0]?.title || ''}",
  "right": "🟥 ימין קצר",
  "left": "🟦 שמאל קצר",
  "sources": ["ynet"]
}]}`;

    console.log('🤖 OpenRouter...');

    const openrouter = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.1-70b-instruct:free',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1
      })
    });

    console.log(`🌐 Status: ${openrouter.status}`);

    if (!openrouter.ok) {
      const errorText = await openrouter.text();
      throw new Error(`HTTP ${openrouter.status}: ${errorText.slice(0,100)}`);
    }

    const result = await openrouter.json();
    const content = result.choices?.[0]?.message?.content || '[]';
    
    console.log('📄 AI content preview:', content.slice(0,100));

    // Type-safe parse
    let aiEvents: any[] = [];
    try {
      const parsed = JSON.parse(content);
      aiEvents = Array.isArray(parsed.events) ? parsed.events : 
                 Array.isArray(parsed) ? parsed : [];
    } catch {
      console.error('JSON failed');
    }

    const events = aiEvents.length 
      ? aiEvents 
      : newsItems.slice(0,5).map(item => ({
          id: item.guid,
          title: item.title,
          right: "פרשנות ימנית",
          left: "פרשנות שמאלנית",
          sources: ["RSS"],
          controversial: true
        }));

    console.log(`🎉 ${events.length} events ready`);
    return NextResponse.json({ events });

  } catch (error: any) {
    console.error('💥 Error:', error?.message || 'Unknown');
    return NextResponse.json({ 
      events: [{
        title: "🚧 טוען...",
        debug: process.env.NODE_ENV === 'development' ? error?.message : undefined
      }]
    });
  }
}
