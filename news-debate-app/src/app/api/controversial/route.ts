import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // RSS שלך - hardcode בינתיים
    const feeds = [
      'https://www.ynet.co.il/Integration/StoryRss2.xml',
      'https://www.israelhayom.co.il/rss_main'
    ];
    
    // Fetch RSS (כמו rss.ts שלך)
    const rssData = await Promise.all(
      feeds.map(async (feed) => {
        const res = await fetch(feed);
        return res.text();
      })
    );
    
    // OpenRouter (env Vercel)
    const openrouter = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://controversy-news.vercel.app'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.1-70b-instruct:free',
        messages: [{
          role: 'user',
          content: `חדשות חמות מ-ynet + israelhayom: ${rssData[0].slice(0,3000)}
          נתח ל-controversial debate cards JSON:
          {"events": [{"title":"...", "right":"...", "left":"...", "sources":["ynet"]}]}` 
        }]
      })
    });
    
    const result = await openrouter.json();
    const events = JSON.parse(result.choices[0]?.message?.content || '[]');
    
    return NextResponse.json({ events });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({
      events: [{
        title: "🚧 RSS + OpenRouter loading...",
        right: "טוען ימין...",
        left: "טוען שמאל...",
        sources: ["ynet", "israelhayom"]
      }]
    });
  }
}
