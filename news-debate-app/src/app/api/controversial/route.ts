import { NextResponse } from 'next/server';
import { fetchHotNews } from '@/lib/rss'; // ודאי שהקובץ הזה קיים ב-lib
import { Redis } from '@upstash/redis';

export const dynamic = 'force-dynamic';

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export async function GET() {
  let aiDebug = "No AI call";
  try {
    // 1. משיכת חדשות רק מה-RSS המגוון שלנו
    const allArticles = await fetchHotNews();

    // 2. בדיקה מול Redis מה כבר מסווג
    let biasMap: Record<string, string> = await redis.hgetall('entity_bias_map') || {};
    
    // שליפת שמות שחסרים ב-Map
    const entities = new Set<string>();
    allArticles.forEach(a => {
      if (a.sourceName) entities.add(a.sourceName.trim());
      if (a.author && a.author.length > 2 && a.author.length < 25) {
        entities.add(a.author.trim());
      }
    });

    const missing = Array.from(entities).filter(e => !biasMap[e]).slice(0, 5);

    // 3. קריאת AI לסיווג (רק עבור החסרים)
    if (missing.length > 0) {
      const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_KEY?.trim()}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://localhost:3000',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-001',
          messages: [{
            role: 'user',
            content: `Categorize these Israeli news entities (right/left/center). Return ONLY JSON: {"Name": "bias"}. Entities: ${missing.join(', ')}`
          }],
          response_format: { type: "json_object" }
        }),
      });

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const content = aiData.choices?.[0]?.message?.content || '{}';
        const newBiases = JSON.parse(content);
        for (const [key, value] of Object.entries(newBiases)) {
          await redis.hset('entity_bias_map', { [key]: String(value).toLowerCase() });
          biasMap[key] = String(value).toLowerCase();
        }
        aiDebug = content;
      }
    }

    // 4. בניית הפיד הסופי ומיונו לפי זמן
    const finalNews = allArticles
      .map(a => ({
        ...a,
        bias: biasMap[a.author] || biasMap[a.sourceName] || 'center'
      }))
      .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    return NextResponse.json({ 
      status: "success",
      totalInRedis: Object.keys(biasMap).length,
      aiRaw: aiDebug,
      newsItems: finalNews.slice(0, 40) 
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message });
  }
}
