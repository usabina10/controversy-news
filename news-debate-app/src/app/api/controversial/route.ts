import { NextResponse } from 'next/server';
import { fetchHotNews } from 'src/lib/rss'; // Adjust path if needed: '../../../lib/rss'

const PROMPT = `List 6-8 major Israeli news outlets covering politics. Classify each by political bias: right-wing (pro-Netanyahu/conservative), center (balanced/mainstream), left-wing (progressive/critical of right). For each, provide their main RSS feed URL. Return ONLY clean JSON: {"feeds":{"right":["https://site1/feed","https://site2/feed"],"center":["https://site3/feed"],"left":["https://site4/feed"]}}. Examples for guidance only: right like Israel Hayom, center like Ynet/Times of Israel, left like Haaretz.`;

export async function GET() {
  try {
    // 1. Fetch hot news from your RSS sources
    const newsItems = await fetchHotNews();
    
    if (newsItems.length === 0) {
      return NextResponse.json({ feeds: { right: [], center: [], left: [] }, newsItems: [] });
    }

    // 2. AI discovers dynamic feeds by bias
    const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://controversy-news.vercel.app', // Required by OpenRouter
        'X-Title': 'Controversy News App'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini:free', // Free tier; upgrade for production
        messages: [{ role: 'user', content: PROMPT }]
      })
    });

    let feeds = { feeds: { right: [], center: [], left: [] } };
    if (aiResponse.ok) {
      const result = await aiResponse.json();
      const content = result.choices?.[0]?.message?.content || '{}';
      feeds = JSON.parse(content);
    }

    return NextResponse.json({ feeds, newsItems });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch dynamic feeds/news', 
        feeds: { feeds: { right: [], center: [], left: [] } },
        newsItems: [] 
      }, 
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { prompt = PROMPT } = await request.json(); // Custom or generic AI discovery

    // 1. Fetch current hot news
    const newsItems = await fetchHotNews();

    // 2. AI call (updated model + headers)
    const ai = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://controversy-news.vercel.app',
        'X-Title': 'Controversy News'
      },
      body: JSON.stringify({
        model: 'google/gemma2-9b-it:free', // Your preferred model
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const result = await ai.json();
    const sources = JSON.parse(result.choices[0]?.message?.content || '{}');

    // 3. Save to public/sources.json (your write-sources API)
    await fetch(`${process.env.VERCEL_URL}/api/write-sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sources)
    });

    // 4. Trigger Vercel redeploy (updates static files)
    await fetch(`https://api.vercel.com/v1/deployments/redeploy?projectId=${process.env.VERCEL_PROJECT_ID}&teamId=${process.env.VERCEL_TEAM_ID || ''}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` }
    });

    return NextResponse.json({ 
      updated: sources.feeds?.length || 0, 
      feeds: sources.feeds,
      newsItems 
    });
  } catch (error: unknown) {
    console.error('POST error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update sources';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// NewsAPI fallback/supercharge
const newsApiRes = await fetch(`https://newsapi.org/v2/top-headlines?country=il&apiKey=${process.env.NEWSAPI_KEY}&pageSize=10`);
const newsApiData = await newsApiRes.json();

// Merge RSS + NewsAPI
const allNews = [...newsItems, ...(newsApiData.articles || []).map(article => ({
  title: article.title,
  link: article.url,
  description: article.description,
  pubDate: article.publishedAt,
  guid: article.url,
  sources: [article.source.name]
}))];
