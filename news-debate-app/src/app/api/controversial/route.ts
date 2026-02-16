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
    // 1. משיכת חדשות ממקורות מגוונים במקביל
    const [newsRes, telegramItems] = await Promise.all([
      // אנחנו מחפשים מילות מפתח ספציפיות כדי "לדוג" מקורות מגוונים
      fetch(`https://newsapi.org/v2/everything?q=${encodeURIComponent('נתניהו OR בן גביר OR אופוזיציה')}&language=he&sortBy=publishedAt&pageSize=40&apiKey=${process.env.NEWSAPI_KEY}`)
        .then(res => res.json())
        .catch(() => ({ articles: [] })),
      fetchHotNews().catch(() => []) // מושך מה-RSS של הטלגרם/מקורות נוספים
    ]);

    // 2. איחוד וסינון כפילויות
    const allArticles = [
      ...telegramItems.map((item: any) => ({
        ...item,
        sourceName: item.source || 'Telegram Source',
        origin: 'RSS/Telegram'
      })),
      ...(newsRes.articles || []).map((a: any) => ({
        id: a.url,
        title: a.title,
        link: a.url,
        pubDate: a.publishedAt,
        sourceName: a.source?.name || 'NewsAPI',
        author: a.author || '',
        origin: 'NewsAPI'
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
