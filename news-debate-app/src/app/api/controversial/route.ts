import { NextResponse } from 'next/server';
import { fetchHotNews } from '@/lib/rss';
import { Redis } from '@upstash/redis';

export const dynamic = 'force-dynamic';

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export async function GET() {
  let aiDebug = "No AI call";
  try {
    const [newsRes, rssItems] = await Promise.all([
      fetch(`https://newsapi.org/v2/everything?q=${encodeURIComponent('ישראל OR פוליטיקה')}&language=he&sortBy=publishedAt&pageSize=40&apiKey=${process.env.NEWSAPI_KEY}`).then(res => res.json()).catch(() => ({ articles: [] })),
      fetchHotNews().catch(() => [])
    ]);

    const allArticles = [
      ...rssItems.map((item: any) => ({ ...item, sourceName: item.source || 'Telegram' })),
      ...(newsRes.articles || []).map((a: any) => ({
        id: a.url, title: a.title, link: a.url, pubDate: a.publishedAt,
        sourceName: a.source?.name || 'NewsAPI', author: a.author || ''
      }))
    ];

    const entities = new Set<string>();
    allArticles.forEach(a => {
      if (a.sourceName && a.sourceName !== 'NewsAPI') entities.add(a.sourceName.trim());
      if (a.author && a.author.length > 2 && a.author.length < 25) {
        const clean = a.author.replace(/כתב[ה]?|מערכת/g, '').trim();
        if (clean) entities.add(clean);
      }
    });

    let biasMap: Record<string, string> = await redis.hgetall('entity_bias_map') || {};
    const missing = Array.from(entities).filter(e => !biasMap[e]).slice(0, 5);

    if (missing.length > 0) {
      const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_KEY?.trim()}`,
          'HTTP-Referer': 'https://narrativeclash.co.il',
          'X-Title': 'NarrativeClash',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-001',
          messages: [{
            role: 'user',
            content: `Categorize these Israeli news entities as "right", "left". 
            Respond ONLY with a JSON object where keys are the names and values are the bias.
            Entities to categorize: ${missing.join(', ')}`
          }],
          response_format: { type: "json_object" }
        }),
      });

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const content = aiData.choices?.[0]?.message?.content || '';
        aiDebug = content;

        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const newBiases = JSON.parse(jsonMatch[0]);
          for (const [key, value] of Object.entries(newBiases)) {
            await redis.hset('entity_bias_map', { [key]: String(value).toLowerCase() });
            biasMap[key] = String(value).toLowerCase();
          }
        }
      } else {
        aiDebug = `Error ${aiRes.status}: ${await aiRes.text()}`;
      }
    }

    return NextResponse.json({ 
      status: "success",
      totalInRedis: Object.keys(biasMap).length,
      aiRaw: aiDebug,
      newsItems: allArticles.map(a => ({
        ...a,
        bias: biasMap[a.author] || biasMap[a.sourceName] || 'center'
      })).slice(0, 20)
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message });
  }
}
