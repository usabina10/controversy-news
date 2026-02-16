import { NextResponse } from 'next/server';
import { fetchHotNews } from '@/lib/rss';
import { Redis } from '@upstash/redis';

export const dynamic = 'force-dynamic';

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const AI_PROMPT = `Analyze the political bias of the following Israeli news entities based on Israeli public perception 2025-2026. 
Categories: 'right', 'center', 'left'. 
Return ONLY clean JSON: {"entity_name": "bias"}. 
Entities: `;

export async function GET() {
  try {
    console.log("--- API Start ---");

    // 1. שליפת מקורות רשמיים + כתבות + RSS
    const [sourcesRes, newsRes, rssItems] = await Promise.all([
      fetch(`https://newsapi.org/v2/top-headlines/sources?country=il&apiKey=${process.env.NEWSAPI_KEY}`).then(res => res.json()).catch(() => ({ sources: [] })),
      fetch(`https://newsapi.org/v2/everything?q=${encodeURIComponent('ישראל OR פוליטיקה')}&language=he&sortBy=publishedAt&pageSize=40&apiKey=${process.env.NEWSAPI_KEY}`).then(res => res.json()).catch(() => ({ articles: [] })),
      fetchHotNews().catch(() => [])
    ]);

    const officialSourceNames = sourcesRes.sources?.map((s: any) => s.name) || [];
    const newsApiArticles = newsRes.articles || [];

    // 2. איחוד כתבות לתצוגה
    const allArticles = [
      ...rssItems.map((item: any) => ({ ...item, sourceName: item.source || 'Telegram', origin: 'Telegram' })),
      ...newsApiArticles.map((a: any) => ({
        id: a.url,
        title: a.title,
        link: a.url,
        pubDate: a.publishedAt,
        sourceName: a.source?.name || 'NewsAPI',
        author: a.author || '',
        origin: 'NewsAPI'
      }))
    ];

    // 3. חילוץ ישויות (Entities) לסיווג
    const entitiesToClassify = new Set<string>(officialSourceNames);
    allArticles.forEach(a => {
      if (a.sourceName && !['Telegram', 'NewsAPI'].includes(a.sourceName)) {
        entitiesToClassify.add(a.sourceName);
      }
      if (a.author && a.author.length > 2 && a.author.length < 25) {
        const cleanName = a.author.replace(/כתב[ה]?|מערכת|/g, '').trim();
        if (cleanName) entitiesToClassify.add(cleanName);
      }
    });

    // 4. בדיקת Redis וסיווג AI
    let biasMap: Record<string, string> = await redis.hgetall('entity_bias_map') || {};
    const missing = Array.from(entitiesToClassify).filter(e => !biasMap[e]);

    if (missing.length > 0) {
      console.log(`System: Found ${missing.length} new entities. Calling AI...`);
      
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
        const content = aiData.choices?.[0]?.message?.content || '{}';
        console.log("System: AI Response Received:", content);

        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const newBiases = JSON.parse(jsonMatch[0]);
            for (const [entity, bias] of Object.entries(newBiases)) {
              const cleanBias = String(bias).toLowerCase();
              await redis.hset('entity_bias_map', { [entity]: cleanBias });
              biasMap[entity] = cleanBias;
            }
            console.log("System: Redis updated with AI results.");
          } catch (e) {
            console.error("System: JSON Parse Error", e);
          }
        }
      } else {
        console.error("System: AI Fetch Failed", aiRes.status);
      }
    }

    // 5. בדיקה בכוח - כתיבת מפתח בדיקה ל-Redis
    await redis.set("last_run_test", "Last run: " + new Date().toISOString());

    // 6. בניית תוצאה סופית
    const finalNews = allArticles.map(a => ({
      ...a,
      bias: biasMap[a.author] || biasMap[a.sourceName] || 'center'
    })).sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    console.log("--- API Complete ---");

    return NextResponse.json({ 
      newsItems: finalNews.slice(0, 30),
      metadata: { 
        totalEntities: entitiesToClassify.size, 
        missingProcessed: missing.length,
        redisStatus: "Check GET last_run_test"
      }
    });

  } catch (error: any) {
    console.error('Critical API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
