import { NextResponse } from 'next/server';
import { fetchTelegramRSS } from '@/lib/rss'; // שינינו את שם הפונקציה לבהירות
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export async function GET() {
  try {
    // 1. משיכה משולבת: API דינמי + RSS של טלגרם
    const [dynamicRes, telegramItems] = await Promise.all([
      // מקור דינמי (למשל ה-API של יוסף או מקור דומה שסורק אתרים)
      fetch(`https://israel-news-api.vercel.app/api/news`)
        .then(res => res.json())
        .catch(() => []),
      
      // ה-RSS של הטלגרם בלבד (הגדרנו ב-lib)
      fetchTelegramRSS().catch(() => [])
    ]);

    // 2. איחוד המקורות לתוך מערך אחד
    const allArticles = [
      ...telegramItems.map((item: any) => ({
        ...item,
        origin: 'Telegram'
      })),
      ...(dynamicRes || []).map((a: any) => ({
        id: a.url || a.link,
        title: a.title,
        link: a.url || a.link,
        pubDate: a.date || a.publishedAt,
        sourceName: a.source || 'דינמי',
        author: a.author || '',
        origin: 'Dynamic API'
      }))
    ];

    // 3. לוגיקת סיווג ה-AI (נשארת זהה, עובדת על המקורות החדשים)
    let biasMap: Record<string, string> = await redis.hgetall('entity_bias_map') || {};
    const entities = new Set<string>();
    allArticles.forEach(a => {
      if (a.sourceName) entities.add(a.sourceName.trim());
      if (a.author && a.author.length > 2 && a.author.length < 25) {
        entities.add(a.author.trim());
      }
    });

    const missing = Array.from(entities).filter(e => !biasMap[e]).slice(0, 5);
    
    // ... כאן נכנס קוד ה-AI שמעדכן את ה-Redis (כמו בגרסאות הקודמות) ...

    const finalNews = allArticles.map(a => ({
      ...a,
      bias: biasMap[a.author] || biasMap[a.sourceName] || 'center'
    })).sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    return NextResponse.json({ 
      status: "success",
      newsItems: finalNews.slice(0, 50) 
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message });
  }
}
