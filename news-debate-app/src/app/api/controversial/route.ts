import { NextResponse } from 'next/server';
import { fetchHotNews } from '@/lib/rss';
import { Redis } from '@upstash/redis';

export const dynamic = 'force-dynamic';

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const AI_PROMPT = `Analyze the political bias of the following Israeli entities (news outlets, journalists, or Telegram channels) based on Israeli public perception 2025-2026. 
Categories: 'right', 'center', 'left'. 
Return ONLY clean JSON: {"entity": "bias"}. 
Entities: `;

export async function GET() {
  try {
    // בדיקה בכוח: כתיבת מפתח בדיקה ל-Redis
    await redis.set("connection_test", "Last run: " + new Date().toISOString());
    console.log("System: Forced Redis write check performed.");
    // 1. שליפת נתונים
    const [rssItems, newsApiData] = await Promise.all([
      fetchHotNews().catch(() => []),
      fetch(`https://newsapi.org/v2/everything?q=${encodeURIComponent('(פוליטיקה OR משפט OR כנסת)')}&language=he&sortBy=publishedAt&apiKey=${process.env.NEWSAPI_KEY}`, { cache: 'no-store' })
        .then(res => res.json())
        .catch(() => ({ articles: [] }))
    ]);

    const newsApiArticles = newsApiData.articles || [];

    // 2. איחוד נתונים
    const allArticles = [
      ...rssItems.map((item: any) => ({
        ...item,
        sourceName: item.source || 'Telegram',
        author: item.author || '',
        origin: 'Telegram'
      })),
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

    // 3. חילוץ ישויות לסיווג
    const entities = new Set<string>();
    allArticles.forEach(a => {
      if (a.sourceName && a.sourceName !== 'Telegram' && a.sourceName !== 'NewsAPI') entities.add(a.sourceName);
      if (a.author && a.author.length > 2 && a.author.length < 40) entities.add(a.author);
    });

    // 4. בדיקת Redis ו-AI (בתוך ה-Try)
    let biasMap: Record<string, string> = await redis.hgetall('entity_bias_map') || {};
    let missing = Array.from(entities).filter(e => !biasMap[e]);

    // בדיקת דאמי אם ריק
    if (missing.length === 0 && Object.keys(biasMap).length === 0) {
      missing = ["ynet", "haaretz", "channel14"];
    }

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
        const content = aiData.choices?.[0]?.message?.content || '{}';
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          const newBiases = JSON.parse(jsonMatch[0]);
          for (const [entity, bias] of Object.entries(newBiases)) {
            const cleanBias = String(bias).toLowerCase();
            await redis.hset('entity_bias_map', { [entity]: cleanBias });
            biasMap[entity] = cleanBias;
          }
        }
      }
    }

    // 5. בניית התוצאה הסופית
    const finalNews = allArticles.map(a => ({
      ...a,
      bias: biasMap[a.author] || biasMap[a.sourceName] || 'center'
    })).sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    // החזרת ה-Response (כעת במיקום הנכון בתוך הפונקציה)
    return NextResponse.json({ 
      newsItems: finalNews.slice(0, 25),
      metadata: { count: finalNews.length }
    });

  } catch (error: any) {
    console.error('Critical API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
