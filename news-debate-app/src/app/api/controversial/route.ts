import { NextResponse } from 'next/server';
import { fetchHotNews } from '@/lib/rss';
import { Redis } from '@upstash/redis';

export const dynamic = 'force-dynamic';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const AI_CLASSIFICATION_PROMPT = `Analyze the following Israeli news entities (outlets or journalists) and classify their political bias based on current public perception and online discourse (2025-2026).
Categories: 'right', 'center', 'left'.
Return ONLY clean JSON: {"entity_name": "bias"}.
Entities to classify: `;

export async function GET() {
  try {
    // 1. שליפת נתונים
    const rssItems = await fetchHotNews().catch(() => []);
    const query = encodeURIComponent('(פוליטיקה OR משפט OR כנסת OR Israel politics)');
    const newsApiRes = await fetch(
      `https://newsapi.org/v2/everything?q=${query}&sortBy=publishedAt&pageSize=20&apiKey=${process.env.NEWSAPI_KEY}`,
      { cache: 'no-store' }
    );
    const newsApiData = await newsApiRes.json();
    const newsApiArticles = newsApiData.articles || [];

    // 2. איחוד ויצירת רשימת ישויות (עיתונים ועיתונאים) לסיווג
    const allArticles = [
      ...rssItems.map((item: any) => ({ ...item, sourceName: 'Telegram/RSS', author: item.author || '' })),
      ...newsApiArticles.map((a: any) => ({
        id: a.url,
        title: a.title,
        link: a.url,
        pubDate: a.publishedAt,
        sourceName: a.source?.name || 'NewsAPI',
        author: a.author || '' // NewsAPI נותן שדה מחבר
      }))
    ];

    // איסוף שמות ייחודיים של מקורות ושל עיתונאים (אם קיימים)
    const entitiesToCheck = new Set<string>();
    allArticles.forEach(a => {
      if (a.sourceName) entitiesToCheck.add(a.sourceName);
      if (a.author && a.author.length > 2 && a.author.length < 30) entitiesToCheck.add(a.author);
    });

    const uniqueEntities = Array.from(entitiesToCheck);

    // 3. בדיקה ב-Redis (מפה מאוחדת לישויות)
    const existingBiases: Record<string, string> = await redis.hgetall('entity_bias_map') || {};
    const missingEntities = uniqueEntities.filter(e => !existingBiases[e]);

    // 4. השלמה ע"י AI אם חסר מידע
    if (missingEntities.length > 0) {
      try {
        const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'google/gemma2-9b-it:free',
            messages: [{ role: 'user', content: AI_CLASSIFICATION_PROMPT + missingEntities.join(', ') }]
          })
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const newBiases = JSON.parse(aiData.choices?.[0]?.message?.content.replace(/```json|```/g, '').trim() || '{}');
          
          for (const [entity, bias] of Object.entries(newBiases)) {
            await redis.hset('entity_bias_map', { [entity]: bias });
            existingBiases[entity] = bias as string;
          }
        }
      } catch (e) { console.error("AI Error", e); }
    }

    // 5. שקלול Bias: עיתונאי גובר על עיתון
    const finalNews = allArticles.map(article => {
      const authorBias = article.author ? existingBiases[article.author] : null;
      const sourceBias = existingBiases[article.sourceName] || 'center';
      
      return {
        ...article,
        // אם יש סיווג לעיתונאי - השתמש בו. אם לא - השתמש בסיווג העיתון.
        bias: authorBias || sourceBias,
        classifiedBy: authorBias ? 'author' : 'source'
      };
    }).sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    return NextResponse.json({ newsItems: finalNews.slice(0, 20) });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
