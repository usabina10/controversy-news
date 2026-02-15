import { NextResponse } from 'next/server';
import { fetchHotNews } from '@/lib/rss';

export const dynamic = 'force-dynamic'; // Prevents Vercel from caching old results

const PROMPT = `List 6-8 major Israeli news outlets covering politics. Classify each by political bias: right-wing (pro-Netanyahu/conservative), center (balanced/mainstream), left-wing (progressive/critical of right). For each, provide their main RSS feed URL. Return ONLY clean JSON: {"feeds":{"right":[],"center":[],"left":[]}}.`;

export async function GET() {
  try {
    // 1. Fetch RSS/Telegram
    const newsItems = await fetchHotNews();
    console.log(`System: Found ${newsItems.length} RSS items`);

   // 2. NewsAPI (Enhanced Search Version)
let newsApiArticles = [];
try {
  // We use /everything and search for 'israel' to ensure we always get results
  // Note: /everything requires a 'q' parameter
  const url = `https://newsapi.org/v2/everything?q=israel&language=he&sortBy=publishedAt&pageSize=10&apiKey=${process.env.NEWSAPI_KEY}`;
  
  const newsApiRes = await fetch(url, { cache: 'no-store' });
  const newsApiData = await newsApiRes.json();

  if (newsApiData.status === "ok") {
    newsApiArticles = newsApiData.articles || [];
    console.log(`System: NewsAPI (Everything) found ${newsApiArticles.length} articles`);
  } else {
    console.error("System: NewsAPI Error ->", newsApiData.message);
  }
} catch (apiErr) {
  console.error("System: NewsAPI Fetch Failed", apiErr);
}

    // 3. Merge & Sort (Newest First)
    const allNews = [
      ...newsItems.map((item: any) => ({ 
        ...item, 
        sourceOrigin: 'Telegram/RSS',
        timestamp: new Date(item.pubDate).getTime() 
      })),
      ...newsApiArticles.map((article: any) => ({
        id: article.url,
        title: article.title,
        link: article.url,
        description: article.description || '',
        pubDate: article.publishedAt,
        timestamp: new Date(article.publishedAt).getTime(),
        sources: [article.source?.name || 'NewsAPI'],
        sourceOrigin: 'NewsAPI'
      }))
    ].sort((a, b) => b.timestamp - a.timestamp);

    // 4. AI Feeds Discovery
    let feeds = { feeds: { right: [], center: [], left: [] } };
    try {
      const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'google/gemma2-9b-it:free',
          messages: [{ role: 'user', content: PROMPT }]
        })
      });

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const content = aiData.choices?.[0]?.message?.content || '{}';
        feeds = JSON.parse(content.replace(/```json|```/g, '').trim());
      }
    } catch (aiErr) {
      console.error("System: AI Feed discovery failed");
    }

    return NextResponse.json({
      feeds,
      newsItems: allNews.slice(0, 15), // Show top 15 mixed
      feedsCount: Object.values(feeds.feeds || {}).flat().length
    });

  } catch (error: any) {
    console.error('Final Catch API error:', error);
    return NextResponse.json({ error: error.message, newsItems: [], feedsCount: 0 }, { status: 500 });
  }
}

// Keep your POST function below as it was, but ensure it's outside the GET brackets
export async function POST(request: Request) {
    // ... (Your POST code)
    return NextResponse.json({ success: true });
}
