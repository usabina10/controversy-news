import { NextResponse } from 'next/server';
import { fetchHotNews } from '@/lib/rss';
import { Redis } from '@upstash/redis';

export const dynamic = 'force-dynamic';

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const AI_PROMPT = `Classify political bias (right/center/left) for these Israeli news entities. Return ONLY a plain JSON object, no markdown, no backticks. Example: {"ynet": "center"}. Entities: `;

export async function GET() {
  try {
    const [sourcesRes, newsRes, rssItems] = await Promise.all([
      fetch(`https://newsapi.org/v2/top-headlines/sources?country=il&apiKey=${process.env.NEWSAPI_KEY}`).then(res => res.json()).catch(() => ({ sources: [] })),
      fetch(`https://newsapi.org/v2/everything?q=${encodeURIComponent('ישראל OR פוליטיקה')}&language=he&sortBy=publishedAt&pageSize=40&apiKey=${process.env.NEWSAPI_KEY}`).then(res => res.json()).catch(() => ({ articles: [] })),
      fetchHotNews().catch(() => [])
    ]);

    const allArticles = [
      ...rssItems.map((item: any) => ({ ...item, sourceName: item.source || 'Telegram', origin: 'Telegram' })),
      ...(newsRes.articles || []).map((a: any) => ({
        id: a.url, title: a.title, link: a.url, pubDate: a.publishedAt,
        sourceName: a.source?.name || 'NewsAPI', author: a.author || '', origin: 'NewsAPI'
      }))
    ];

    const entities = new Set<string>();
    allArticles.forEach(a => {
      if (a.sourceName && a.sourceName !== 'NewsAPI') entities.add(a.sourceName);
      if (a.author && a.author.length > 2 && a.author.length < 25) {
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
          messages: [{ role: 'user', content: AI_PROMPT + missing.join(', ') }]
        })
      });

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const content = aiData.choices?.[0]?.message?.content || '';
        
        // ניקוי אגרסיבי של כל מה שאינו JSON
        const cleanJson = content.replace(/```json|```/g, '').trim();
        const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          try {
            const newBiases = JSON.parse(jsonMatch[0]);
            // כתיבה ישירה אחד-אחד כדי להבטיח הצלחה
            for (const key in newBiases) {
              await redis.hset('entity_bias_map', { [key]: String(newBiases[key]).toLowerCase() });
              biasMap[key] = String(newBiases[key]).toLowerCase();
            }
          } catch (e) { console.error("JSON parse error"); }
        }
      }
    }

    const finalNews = allArticles.map(a => ({
      ...a,
      bias: biasMap[a.author] || biasMap[a.sourceName] || 'center'
    })).sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    return NextResponse.json({ 
      stats: { total: allArticles.length, missing: missing.length, inRedis: Object.keys(biasMap).length },
      newsItems: finalNews.slice(0, 40) 
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
