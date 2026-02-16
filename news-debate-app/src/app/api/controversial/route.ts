import { NextResponse } from 'next/server';
import { fetchHotNews } from '@/lib/rss';
import { Redis } from '@upstash/redis';

export const dynamic = 'force-dynamic';

// חיבור ל-Redis באמצעות המשתנים שקיימים ב-Vercel
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
    console.log("System: Starting news fetch and bias classification...");

    // 1. שליפת נתונים במקביל מ-NewsAPI ומה-RSS
    const [rssItems, newsApiData] = await Promise.all([
      fetchHotNews().catch((err) => {
        console.error("RSS Fetch Error:", err);
        return [];
      }),
      fetch(`https://newsapi.org/v2/everything?q=${encodeURIComponent('(פוליטיקה OR משפט OR כנסת)')}&language=he&sortBy=publishedAt&apiKey=${process.env.NEWSAPI_KEY}`, { cache: 'no-store' })
        .then(res => res.json())
        .catch(() => ({ articles: [] }))
    ]);

    const newsApiArticles = newsApiData.articles || [];

    // 2. איחוד הנתונים למבנה אחיד
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
        description: a.description || '',
        pubDate: a.publishedAt,
        sourceName: a.source?.name || 'NewsAPI',
        author: a.author || '',
        origin: 'NewsAPI'
      }))
    ];

    // 3. חילוץ ישויות ייחודיות לבדיקת Bias
    const entities = new Set<string>();
    allArticles.forEach(a => {
      if (a.sourceName && a.sourceName !== 'Telegram' && a.sourceName !== 'NewsAPI') {
        entities.add(a.sourceName);
      }
      if (a.author && a.author.length > 2 && a.author.length < 40) {
        entities.add(a.author);
      }
    });

    // 4. בדיקת Bias ב-Redis ושלימה מה-AI במידת הצורך
    let biasMap: Record<string, string> = await redis.hgetall('entity_bias_map') || {};
    const missing = Array.from(entities).filter(e => !biasMap[e]);
    // חפשי את השורה הזו:
const missing = Array.from(entities).filter(e => !biasMap[e]);

// הוסיפי מיד אחריה את השורה הזו לבדיקה:
if (missing.length === 0) missing.push("ynet_test", "ערוץ_14_test"); 

console.log("Entities to classify:", missing);
    if (missing.length > 0) {
      console.log(`System: Classifying ${missing.length} new entities via AI...`);
      try {
        const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${process.env.OPENROUTER_KEY}`, 
            'Content-Type': 'application/json' 
          },
          body: JSON.stringify({
            model: 'google/gemma2-9b-it:free',
            messages: [{ role: 'user', content: AI_PROMPT + missing.join(', ') }]
          })
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const rawContent = aiData.choices?.[0]?.message?.content || '{}';
          
          // ניקוי חסין של ה-JSON (חילוץ המבנה מתוך טקסט)
          const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const newBiases = JSON.parse(jsonMatch[0]);
            
            // עדכון ה-Redis והמפה המקומית
            for (const [entity, bias] of Object.entries(newBiases)) {
              const cleanBias = String(bias).toLowerCase();
              await redis.hset('entity_bias_map', { [entity]: cleanBias });
              biasMap[entity] = cleanBias;
            }
            console.log("System: Redis updated successfully.");
          }
        }
      } catch (aiError) {
        console.error("System: AI Classification failed", aiError);
      }
    }

    // 5. הצמדת ה-Bias ומיון סופי (עיתונאי גובר על מקור)
    const finalNews = allArticles.map(a => {
      const authorBias = a.author ? biasMap[a.author] : null;
      const sourceBias = biasMap[a.sourceName] || 'center';
      
      return {
        ...a,
        bias: authorBias || sourceBias,
        biasSource: authorBias ? 'author' : 'outlet'
      };
    }).sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    // 6. החזרת התוצאה
    return NextResponse.json({ 
      newsItems: finalNews.slice(0, 25),
      metadata: {
        timestamp: new Date().toISOString(),
        count: finalNews.length
      }
    });

  } catch (error: any) {
    console.error('Critical API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
