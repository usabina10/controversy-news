import { NextResponse } from 'next/server';
import { fetchHotNews } from '@/lib/rss'; // Using @ alias is standard in Next.js

const PROMPT = `List 6-8 major Israeli news outlets covering politics. Classify each by political bias: right-wing (pro-Netanyahu/conservative), center (balanced/mainstream), left-wing (progressive/critical of right). For each, provide their main RSS feed URL. Return ONLY clean JSON: {"feeds":{"right":["https://site1/feed"],"center":["https://site3/feed"],"left":["https://site4/feed"]}}. Examples for guidance only: right like Israel Hayom, center like Ynet/Times of Israel, left like Haaretz.`;

export async function GET() {
  try {
    // 1. RSS Hybrid
    const newsItems = await fetchHotNews();

    // 2. NewsAPI
   // 2. NewsAPI (Debug Version)
let newsApiArticles = [];
try {
  const url = `https://newsapi.org/v2/top-headlines?country=il&apiKey=${process.env.NEWSAPI_KEY}&pageSize=10`;
  
  // LOG 1: Check if the key exists
  console.log("Fetching NewsAPI with Key:", process.env.NEWSAPI_KEY ? "EXISTS" : "MISSING");

  const newsApiRes = await fetch(url);
  const newsApiData = await newsApiRes.json();

  // LOG 2: Check the API response status
  if (newsApiData.status === "error") {
    console.error("NewsAPI returned an error:", newsApiData.message);
  } else {
    newsApiArticles = newsApiData.articles || [];
    console.log(`Successfully found ${newsApiArticles.length} articles from NewsAPI`);
  }
} catch (err) {
  // LOG 3: Catch network or parsing errors
  console.error('NewsAPI fetch failed completely:', err);
}

    // 3. Merge RSS + NewsAPI
    const allNews = [
  ...newsItems.map(item => ({
    ...item,
    sourceName: 'Telegram/RSS', // Explicit source name
    displayDate: item.pubDate,
  })),
  ...newsApiArticles.map((article: any) => ({
    id: article.url,
    title: article.title || '',
    link: article.url,
    description: article.description || '',
    pubDate: article.publishedAt,
    displayDate: new Date(article.publishedAt).toLocaleString(),
    sourceName: article.source?.name || 'NewsAPI', // Use the actual outlet name (e.g., Ynet)
    guid: article.url,
  }))
].sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()); // Sort by newest first

    // 4. AI Dynamic sources
    let feeds = { feeds: { right: [], center: [], left: [] } };
    try {
      const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.VERCEL_URL || 'http://localhost:3000',
        },
        body: JSON.stringify({
          model: 'google/gemma2-9b-it:free',
          messages: [{ role: 'user', content: PROMPT }],
        }),
      });

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const content = aiData.choices?.[0]?.message?.content || '{}';
        // Clean markdown backticks if AI includes them
        const cleanJson = content.replace(/```json|```/g, '').trim();
        feeds = JSON.parse(cleanJson);
      }
    } catch (aiError) {
      console.error('AI feeds parsing error:', aiError);
    }

    return NextResponse.json({
      feeds,
      newsItems: allNews.slice(0, 10),
      feedsCount: Object.values(feeds.feeds || {}).flat().length,
    });
  } catch (error: unknown) {
    console.error('API error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMsg, newsItems: [], feedsCount: 0 }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const prompt = body.prompt || PROMPT;

    const newsItems = await fetchHotNews();

    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.VERCEL_URL || 'http://localhost:3000',
        'X-Title': 'Controversy News',
      },
      body: JSON.stringify({
        model: 'google/gemma2-9b-it:free',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content || '{}';
    const sources = JSON.parse(content.replace(/```json|```/g, '').trim());

    // Update internal sources
    if (process.env.VERCEL_URL) {
        await fetch(`${process.env.VERCEL_URL}/api/write-sources`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sources),
        }).catch(err => console.error("Source write failed", err));
    }

    return NextResponse.json({
      updated: true,
      feeds: sources.feeds,
      newsItems,
    });
  } catch (error: unknown) {
    console.error('POST error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update sources';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
