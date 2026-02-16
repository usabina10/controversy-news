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
 // 1. שליפת מקורות רשמיים מ-NewsAPI (מה שביקשת) + חדשות
    const [sourcesRes, newsRes, rssItems] = await Promise.all([
      fetch(`https://newsapi.org/v2/top-headlines/sources?country=il&apiKey=${process.env.NEWSAPI_KEY}`).then(res => res.json()),
      fetch(`https://newsapi.org/v2/everything?q=${encodeURIComponent('ישראל OR פוליטיקה')}&language=he&sortBy=publishedAt&pageSize=40&apiKey=${process.env.NEWSAPI_KEY}`).then(res => res.json()),
      fetchHotNews().catch(() => [])
    ]);

    // 2. איסוף כל השמות האפשריים לסיווג
    const entities = new Set<string>();

    // הוספת המקורות הרשמיים מה-API שביקשת
    if (sourcesRes.sources) {
      sourcesRes.sources.forEach((s: any) => {
        if (s.name) entities.add(s.name);
      });
    }

    // חילוץ עיתונאים ומקורות מתוך הכתבות
    if (newsRes.articles) {
      newsRes.articles.forEach((a: any) => {
        if (a.source?.name) entities.add(a.source.name);
        if (a.author && a.author.length > 2 && a.author.length < 25) {
          const cleanName = a.author.replace(/כתב[ה]?|מערכת|/g, '').trim();
          if (cleanName) entities.add(cleanName);
        }
      });
    }

    console.log(`System: Total unique entities found: ${entities.size}`);
    console.log("System: Samples:", Array.from(entities).slice(0, 5));

    // 3. חילוץ דינמי של ישויות (Entities)
    const entities = new Set<string>(officialSourceNames); // מתחילים עם המקורות הרשמיים של NewsAPI
    
    allArticles.forEach(a => {
      // מוסיפים את שם האתר/ערוץ
      if (a.sourceName && a.sourceName !== 'Telegram' && a.sourceName !== 'NewsAPI') {
        entities.add(a.sourceName);
      }
      // מוסיפים את שם העיתונאי (אם קיים ותקין)
      if (a.author && a.author.length > 2 && a.author.length < 30) {
        const cleanAuthor = a.author.replace(/כתב[ה]?|מערכת|/g, '').trim();
        if (cleanAuthor) entities.add(cleanAuthor);
      }
    });

    // --- כאן נכנסת הבדיקה בכוח ל-Redis שדיברנו עליה ---
    await redis.set("connection_test", "Last run: " + new Date().toISOString());

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
