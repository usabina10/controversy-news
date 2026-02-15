import { NextResponse } from 'next/server';
import { fetchHotNews } from '@/lib/rss';
import { Redis } from '@upstash/redis';

export const dynamic = 'force-dynamic';

// חיבור ל-Upstash Redis
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const AI_PROMPT = `Analyze the following Israeli news sources and classify their political bias based on current public perception and online discourse in 2025-2026. 
Categories: 'right', 'center', 'left'. 
Return ONLY clean JSON: {"source_name": "bias"}.
Sources: `;

export async function GET() {
  try {
    // 1. שליפת חדשות מ-NewsAPI (פוליטיקה ומשפט)
    let newsApiArticles = [];
    try {
      const query = encodeURIComponent('(פוליטיקה OR משפט OR כנסת OR בג"ץ OR נתניהו OR Israel politics)');
      const newsApiRes = await fetch(
        `https://newsapi.org/v2/everything?q=${query}&sortBy=publishedAt&pageSize=15&apiKey=${process.env.NEWSAPI_KEY}`,
        { cache: 'no-store' }
      );
      const newsApiData = await newsApiRes.json();
      newsApiArticles = newsApiData.articles || [];
    } catch (e) {
      console.error("NewsAPI Error:", e);
    }

    // 2. שליפת חדשות מ-RSS/טלגרם
    const rssItems = await fetchHotNews().catch(() => []);

    // 3. איחוד מקורות לצורך סיווג
    const allArticles = [
      ...rssItems.map((item: any) => ({ ...item, sourceName: 'Telegram/RSS' })),
      ...newsApiArticles.map((a: any) => ({
        id: a.url,
        title: a.title,
        link: a.url,
        description: a.description,
        pubDate: a.publishedAt,
        sourceName: a.source?.name || 'NewsAPI'
      }))
    ];

    // 4. ניהול Bias דינמי מול Redis ו-AI
    const uniqueSources = Array.from(new Set(allArticles.map(a => a.sourceName)));
    
    // שליפת כל הסיווגים הקיימים ב-Redis במכה אחת
    const existingBiases: Record<string, string> = await redis.hgetall('bias_map') || {};
    
    // זיהוי מקורות חדשים שאין להם סיווג
    const missingSources = uniqueSources.filter(s => !existingBiases[s]);

    if (missingSources.length > 0) {
      try {
        const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'google/gemma2-9b-it:free',
            messages: [{ role: 'user', content: AI_PROMPT + missingSources.join(', ') }]
          })
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const content = aiData.choices?.[0]?.message?.content || '{}';
          const newBiases = JSON.parse(content.replace(/```json|```/g, '').trim());
          
          // שמירת הסיווגים החדשים ב-Redis (Hash set)
          for (const [source, bias] of Object.entries(newBiases)) {
            await redis.hset('bias_map', { [source]: bias });
            existingBiases[source] = bias as string;
          }
        }
      } catch (aiErr) {
        console.error("AI Classification failed", aiErr);
      }
    }

    // 5. הצמדת ה-Bias לכל ידיעה ומיון סופי
    const finalNews = allArticles.map(article => ({
      ...article,
      bias: existingBiases[article.sourceName] || 'center'
    })).sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    return NextResponse.json({
      newsItems: finalNews.slice(0, 20),
      stats: {
        total: finalNews.length,
        sourcesCount: uniqueSources.length
      }
    });

  } catch (error: any) {
    console.error('Final API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
