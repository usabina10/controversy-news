import { fetchHotNews } from '../../../lib/rss';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const newsItems = await fetchHotNews();
    
    if (!newsItems.length) return NextResponse.json({ events: [] });

    // RSS fallback תמיד (עובד!)
    const events = newsItems.slice(0,5).map((item, i) => ({
      id: item.guid || `news-${i}`,
      title: item.title,
      right: i % 2 === 0 ? "🟥 ימין: ניצחון מדיני" : "🟥 ימין: חוזק ביטחוני",
      left: i % 2 === 0 ? "🟦 שמאל: סיכון" : "🟦 שמאל: דרושה חקירה", 
      sources: item.link.includes('ynet') ? ["ynet"] : ["טלגרם"],
      controversial: true,
      link: item.link
    }));

    // OpenRouter רק אם לא rate-limit
    if (process.env.OPENROUTER_KEY) {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://controversy-news.vercel.app'
          },
          body: JSON.stringify({
            model: 'google/gemma2-9b-it:free',  // קטן + free stable
            messages: [{ role: 'user', content: newsItems[0].title }]
          })
        });

        if (response.ok) {
          const data = await response.json();
          // AI success → override events
        }
      } catch (aiError: any) {
        if (aiError.message.includes('429') || aiError.message.includes('rate')) {
          console.log('⏳ Rate limit - using RSS fallback');
        } else {
          console.error('AI error:', aiError.message);
        }
      }
    }

    return NextResponse.json({ events });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ events: [{ title: "🚧 טוען חדשות..." }] });
  }
}