import { NextResponse } from 'next/server';
import { fetchHotNews } from '@/lib/rss';
import { Redis } from '@upstash/redis';

export const dynamic = 'force-dynamic';

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export async function GET() {
  let aiDebug = "No AI call made";
  try {
    const [newsRes, rssItems] = await Promise.all([
      fetch(`https://newsapi.org/v2/everything?q=${encodeURIComponent('ישראל OR פוליטיקה')}&language=he&sortBy=publishedAt&pageSize=20&apiKey=${process.env.NEWSAPI_KEY}`).then(res => res.json()).catch(() => ({ articles: [] })),
      fetchHotNews().catch(() => [])
    ]);

    const allArticles = [
      ...rssItems.map((item: any) => ({ ...item, sourceName: item.source || 'Telegram' })),
      ...(newsRes.articles || []).map((a: any) => ({
        id: a.url, title: a.title, link: a.url, pubDate: a.publishedAt,
        sourceName: a.source?.name || 'NewsAPI', author: a.author || ''
      }))
    ];

    // חילוץ שמות וניקוי בסיסי
    const entities = new Set<string>();
    allArticles.forEach(a => {
      if (a.sourceName && a.sourceName !== 'NewsAPI') entities.add(a.sourceName.trim());
      if (a.author && a.author.length > 2 && a.author.length < 20) {
        const clean = a.author.replace(/כתב[ה]?|מערכת/g, '').trim();
        if (clean) entities.add(clean);
      }
    });

    let biasMap: Record<string, string> = await redis.hgetall('entity_bias_map') || {};
    const missing = Array.from(entities).filter(e => !biasMap[e]);

    if (missing.length > 0) {
      const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${process.env.OPENROUTER_KEY}`, 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.2-3b-instruct:free', 
          messages: [{ 
            role: 'user', 
            content: `Return ONLY a JSON object mapping these Israeli entities to "right", "left", or "center". 
            Entities: ${missing.join(', ')}` 
          }]
        })
      });

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const content = aiData.choices?.[0]?.message?.content || '';
        aiDebug = content; // שומרים את התשובה הגולמית לבדיקה

        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const newBiases = JSON.parse(jsonMatch[0]);
          
          // כתיבה ל-Redis עם לוגיקה לטיפול בעברית
          for (const [key, value] of Object.entries(newBiases)) {
            const cleanKey = String(key).trim();
            const cleanValue = String(value).toLowerCase().trim();
            
            // כתיבה אסינכרונית ללא המתנה (כדי לא לעכב את התגובה)
            redis.hset('entity_bias_map', { [cleanKey]: cleanValue });
            biasMap[cleanKey] = cleanValue;
          }
        }
      } else {
        aiDebug = `AI Error: ${aiRes.status}`;
      }
    }

    return NextResponse.json({ 
      debug: {
        aiRawResponse: aiDebug,
        entitiesSent: missing,
        redisSize: Object.keys(biasMap).length
      },
      newsItems: allArticles.map(a => ({
        ...a,
        bias: biasMap[a.author] || biasMap[a.sourceName] || 'center'
      })).slice(0, 30)
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message, aiDebug });
  }
}
