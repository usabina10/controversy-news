import { NextResponse } from 'next/server';
import { fetchHotNews } from '@/lib/rss'; // ודאי שהקובץ הזה קיים ב-lib
import { Redis } from '@upstash/redis';

export const dynamic = 'force-dynamic';

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export async function GET() {
  try {
  // 1. משיכת נתונים מ-Israel-API (מקורות כמו N12, ערוץ 14 וכו')
    const [newsRes, israelApiRes, rssItems] = await Promise.all([
      fetch(`https://newsapi.org/v2/everything?q=${encodeURIComponent('ישראל')}&language=he&apiKey=${process.env.NEWSAPI_KEY}`)
        .then(res => res.json()).catch(() => ({ articles: [] })),
      
      // שימוש ב-Israel-API (דוגמה לנתיב פופולרי מהפרויקט שלו)
      fetch(`https://israel-news-api.vercel.app/api/news`) 
        .then(res => res.json()).catch(() => []),
        
      fetchHotNews().catch(() => []) 
    ]);

    // 2. איחוד המקורות - שימי לב למיפוי השדות מ-Israel-API
    const allArticles = [
      ...rssItems,
      ...(israelApiRes || []).map((a: any) => ({
        id: a.url || a.link,
        title: a.title,
        link: a.url || a.link,
        pubDate: a.date || a.publishedAt,
        sourceName: a.source || 'Israel-API',
        author: a.author || ''
      })),
      ...(newsRes.articles || []).map((a: any) => ({
        id: a.url,
        title: a.title,
        link: a.url,
        pubDate: a.publishedAt,
        sourceName: a.source?.name || 'NewsAPI',
        author: a.author || ''
      }))
    ];
    // 3. לוגיקת ה-AI (נשארת אותו דבר, היא עובדת מצוין)
    let biasMap: Record<string, string> = await redis.hgetall('entity_bias_map') || {};
    const entities = new Set<string>();
    allArticles.forEach(a => {
      if (a.sourceName) entities.add(a.sourceName.trim());
      if (a.author && a.author.length > 2 && a.author.length < 25) {
        entities.add(a.author.trim());
      }
    });

    const missing = Array.from(entities).filter(e => !biasMap[e]).slice(0, 5);
    
    if (missing.length > 0) {
      // כאן רץ הקוד של ה-AI שכתבנו קודם... (דילגתי לקיצור, תשאירי את מה שיש לך)
    }

    // 4. בניית הפיד הסופי - מיון לפי תאריך
    const finalNews = allArticles
      .map(a => ({
        ...a,
        bias: biasMap[a.author] || biasMap[a.sourceName] || 'center'
      }))
      .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    return NextResponse.json({ 
      status: "success",
      totalInRedis: Object.keys(biasMap).length,
      newsItems: finalNews.slice(0, 50) 
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message });
  }
}
