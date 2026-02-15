import { NextResponse } from 'next/server';
import { fetchHotNews } from '@/lib/rss';
import { Redis } from '@upstash/redis';

export const dynamic = 'force-dynamic';

// חיבור ל-Redis באמצעות המשתנים שקיימים אצלך ב-Vercel
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
    // 1. שליפת נתונים מכל המקורות
    const [rssItems, newsApiData] = await Promise.all([
      fetchHotNews().catch(() => []),
      fetch(`https://newsapi.org/v2/everything?q=${encodeURIComponent('(פוליטיקה OR משפט OR כנסת)')}&language=he&sortBy=publishedAt&apiKey=${process.env.NEWSAPI_KEY}`).then(res => res.json()).catch(() => ({ articles: [] }))
    ]);

    const newsApiArticles = newsApiData.articles || [];

    // 2. עיבוד ואיחוד: חילוץ שמות ערוצים ועיתונאים
    const allArticles = [
      ...rssItems.map((item: any) => ({
        ...item,
        sourceName: item.source || 'Telegram', // שם ערוץ הטלגרם
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

    // 3. איסוף כל הישויות שצריכות סיווג (ערוצים, עיתונים, כותבים)
    const entities = new Set<string>();
    allArticles.forEach(a => {
      if (a.sourceName) entities.add(a.sourceName);
      if (a.author && a.author.length > 2) entities.add(a.author);
    });

    // 4. בדיקה ב-Redis וסיווג AI משלים
    const biasMap: Record<string, string> = await redis.hgetall('entity_bias_map') || {};
    const missing = Array.from(entities).filter(e => !biasMap[e]);

    if (missing.length > 0) {
      const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemma2-9b-it:free',
          messages: [{ role: 'user', content: AI_PROMPT + missing.join(', ') }]
        })
      });

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const newBiases = JSON.parse(aiData.choices?.[0]?.message?.content.replace(/```json|```/g, '').trim() || '{}');
        for (const [entity, bias] of Object.entries(newBiases)) {
          await redis.hset('entity_bias_map', { [entity]: bias });
          biasMap[entity] = bias as string;
        }
      }
    }

    // 5. הצמדת Bias (עיתונאי גובר על ערוץ/עיתון)
    const finalNews = allArticles.map(a => ({
      ...a,
      bias: biasMap[a.author] || biasMap[a.sourceName] || 'center'
    })).sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    return NextResponse.json({ newsItems: finalNews.slice(0, 20) });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
