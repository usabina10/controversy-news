import { NextResponse } from 'next/server';
import { fetchHotNews } from '@/lib/rss';
import { Redis } from '@upstash/redis';

export const dynamic = 'force-dynamic';

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const AI_PROMPT = `Return ONLY a JSON object mapping these Israeli news entities to "right", "left". 
No talk, no markdown. Example: {"ynet": "left"}. 
Entities: `;

export async function GET() {
  let aiDebug = "No AI call made";
  try {
    // 1. איסוף נתונים מ-NewsAPI ו-RSS
    const [newsRes, rssItems] = await Promise.all([
      fetch(`https://newsapi.org/v2/everything?q=${encodeURIComponent('ישראל OR פוליטיקה')}&language=he&sortBy=publishedAt&pageSize=40&apiKey=${process.env.NEWSAPI_KEY}`)
        .then(res => res.json())
        .catch(() => ({ articles: [] })),
      fetchHotNews().catch(() => [])
    ]);

    // 2. איחוד כתבות
    const allArticles = [
      ...rssItems.map((item: any) => ({ ...item, sourceName: item.source || 'Telegram', origin: 'Telegram' })),
      ...(newsRes.articles || []).map((a: any) => ({
        id: a.url,
        title: a.title,
        link: a.url,
        pubDate: a.publishedAt,
        sourceName: a.source?.name || 'NewsAPI',
        author: a.author || '',
        origin: 'NewsAPI'
      }))
    ];

    // 3. חילוץ שמות וניקוי
    const entities = new Set<string>();
    allArticles.forEach(a => {
      if (a.sourceName && a.sourceName !== 'NewsAPI') entities.add(a.sourceName.trim());
      if (a.author && a.author.length > 2 && a.author.length < 25) {
        const clean = a.author.replace(/כתב[ה]?|מערכת/g, '').trim();
        if (clean) entities.add(clean);
      }
    });

    // 4. בדיקה מול Redis (רק מה שחסר)
    let biasMap: Record<string, string> = await redis.hgetall('entity_bias_map') || {};
    
    // שליחת מקסימום 5 שמות בכל פעם כדי למנוע שגיאת 429 (Too Many Requests)
    const missing = Array.from(entities)
      .filter(e => !biasMap[e] && e !== 'בדיקת_חיבור')
      .slice(0, 5);

    if (missing.length > 0) {
      const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${process.env.OPENROUTER_KEY?.trim()}`, // ניקוי רווחים אוטומטי
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-lite-preview-02-05:free', 
          messages: [{ 
            role: 'user', 
            content: `Classify these as JSON {"name": "right/left/center"}: ${missing.join(', ')}` 
          }]
        })
      });
      
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const content = aiData.choices?.[0]?.message?.content || '';
        aiDebug = content;

        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const newBiases = JSON.parse(jsonMatch[0]);
            for (const [key, value] of Object.entries(newBiases)) {
              const cleanKey = String(key).trim();
              const cleanValue = String(value).toLowerCase().trim();
              // כתיבה ל-Redis
              await redis.hset('entity_bias_map', { [cleanKey]: cleanValue });
              biasMap[cleanKey] = cleanValue;
            }
          } catch (e) {
            console.error("JSON parse error", e);
          }
        }
      } else {
        aiDebug = `AI Error: ${aiRes.status}`;
      }
    }

    // 5. הצמדת הטיות לכתבות
    const finalNews = allArticles.map(a => ({
      ...a,
      bias: biasMap[a.author] || biasMap[a.sourceName] || 'center'
    })).sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    return NextResponse.json({ 
      debug: {
        aiResponse: aiDebug,
        missingClassified: missing,
        totalInRedis: Object.keys(biasMap).length
      },
      newsItems: finalNews.slice(0, 35)
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
