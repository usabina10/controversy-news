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

    // Debug env
    console.log('🔑 OPENROUTER_KEY exists:', !!process.env.OPENROUTER_KEY);

    if (!process.env.OPENROUTER_KEY) {
      console.log('⚠️ No OpenRouter key - RSS fallback');
      return NextResponse.json({ 
        events: newsItems.slice(0,5).map(item => ({
          id: item.guid,
          title: item.title,
          right: "פרשנות ימנית (ישראל היום)",
          left: "פרשנות שמאלנית (הארץ)", 
          sources: item.link.includes('t.me') ? ["טלגרם"] : ["ynet"],
          controversial: true
        }))
      });
    }

    // OpenRouter call
    const prompt = `חדשות שנויות:
${newsItems.slice(0,3).map(n => n.title).join('\n')}

JSON תקין:
{"events": [{
  "title": "${newsItems[0]?.title || ''}",
  "right": "🟥 ימין: 1-2 משפטים קצרים",
  "left": "🟦 שמאל: 1-2 משפטים קצרים",
  "sources": ["ynet", "טלגרם"]
}]} 
3 events בדיוק!`;

    console.log('🤖 Sending to OpenRouter...');

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

    console.log(`🌐 OpenRouter status: ${openrouter.status}`);

    if (!openrouter.ok) {
      const errorText = await openrouter.text();
      console.error('❌ OpenRouter error:', errorText);
      throw new Error(`Status ${openrouter.status}: ${errorText.slice(0,200)}`);
    }

    const result = await openrouter.json();
    console.log('✅ OpenRouter got response');

    const content = result.choices?.[0]?.message?.content || '[]';
    let aiEvents: any[] = [];
    
    try {
      aiEvents = JSON.parse(content);
    } catch (parseError) {
      console.error('❌ JSON parse failed:', content.slice(0,300));
    }

    const events = (aiEvents.events || aiEvents || []).length 
      ? (aiEvents.events || aiEvents)
      : newsItems.slice(0,5).map(item => ({
          id: item.guid,
          title: item.title,
          right: "פרשנות ימנית",
          left: "פרשנות שמאלנית",
          sources: ["fallback"],
          controversial: true
        }));

    console.log(`🎉 Returning ${events.length} events`);
    return NextResponse.json({ events });

  } catch (error: any) {
    console.error('💥 Full API error:', error.message);
    return NextResponse.json({ 
      events: [{
        title: "🚧 טוען חדשות + AI...",
        right: "בודק OpenRouter...",
        left: "RSS OK, AI loading...",
        sources: ["debug"],
        controversial: true
      }],
      debug: { error: error.message }
    });
  }
}
