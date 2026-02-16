import { NextResponse } from 'next/server';
import { fetchHotNews } from '@/lib/rss';
import { Redis } from '@upstash/redis';

export const dynamic = 'force-dynamic';

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const AI_PROMPT = `Analyze the political bias of the following Israeli news entities (right, center, left). Return ONLY a JSON object: {"name": "bias"}. Entities: `;

export async function GET() {
  try {
    // 1. שליפת נתונים
    const [sourcesRes, newsRes, rssItems] = await Promise.all([
      fetch(`https://newsapi.org/v2/top-headlines/sources?country=il&apiKey=${process.env.NEWSAPI_KEY}`).then(res => res.json()).catch(() => ({ sources: [] })),
      fetch(`https://newsapi.org/v2/everything?q=${encodeURIComponent('ישראל OR עזה OR פוליטיקה')}&language=he&sortBy=publishedAt&pageSize=40&apiKey=${process.env.NEWSAPI_KEY}`).then(res => res.json()).catch(() => ({ articles: [] })),
      fetchHotNews().catch(() => [])
    ]);

    // 2. איחוד כתבות (עם דגש על חילוץ מקור מהטלגרם)
    const allArticles = [
      ...rssItems.map((item: any) => ({
        id: item.link || Math.random().toString(),
        title: item.title,
        link: item.link,
        pubDate: item.pubDate || new Date().toISOString(),
        sourceName: item.source || 'ערוץ טלגרם', // כאן אנחנו מחלצים את המקור מה-RSS
        origin: 'Telegram'
      })),
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

    // 3. חילוץ שמות לסיווג (Entities)
    const entities = new Set<string>();
    
    // הוספת המקורות הרשמיים
    if (sourcesRes.sources) {
      sourcesRes.sources.forEach((s: any) => entities.add(s.name));
    }

    // סריקת הכתבות שהגיעו בפועל
    allArticles.forEach(a => {
      if (a.sourceName && a.sourceName !== 'NewsAPI') {
        entities.add(a.sourceName);
      }
      if (a.author && a.author.length > 2 && a.author.length < 25) {
        const cleanAuthor = a.author.replace(/כתב[ה]?|מערכת/g, '').trim();
        if (cleanAuthor) entities.add(cleanAuthor);
      }
    });

    // 4. בדיקה מול Redis
    let biasMap: Record<string, string> = await redis.hgetall('entity_bias_map') || {};
    const missing = Array.from(entities).filter(e => !biasMap[e] && e.length > 1);

    // 5. הפעלת AI אם חסרים מקורות
    if (missing.length > 0) {
      const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${process.env.OPENROUTER_KEY}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-lite-preview-02-05:free',
          messages: [{ role: 'user', content: AI_PROMPT + missing.join(', ') }]
        })
      });

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const content = aiData.choices?.[0]?.message?.content || '';
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          try {
            const newBiases = JSON.parse(jsonMatch[0]);
            const p = redis.pipeline();
            for (const [entity, bias] of Object.entries(newBiases)) {
              const b = String(bias).toLowerCase();
              p.hset('entity_bias_map', { [entity]: b });
              biasMap[entity] = b;
            }
            await p.exec();
          } catch (e) { console.error("Parse error"); }
        }
      }
    }

    // 6. הצמדת ה-Bias לכתבות
    const finalNews = allArticles.map(a => ({
      ...a,
      bias: biasMap[a.author] || biasMap[a.sourceName] || 'center'
    })).sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    // 7. החזרת תשובה מפורטת לצורך Debug
    return NextResponse.json({ 
      stats: {
        totalNews: allArticles.length,
        uniqueEntities: entities.size,
        classifiedThisRun: missing.length
      },
      entitiesFound: Array.from(entities),
      newsItems: finalNews.slice(0, 40)
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
