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

export async function POST() {
  try {
   const prompt = "Find Israeli political news RSS feeds by bias: Right (Israel Hayom, Channel 14), Center (Ynet, Times of Israel), Left (Haaretz, Kan 11). Return clean JSON: {\"feeds\":{\"right\":[\"https://rss1\",\"https://rss2\"],\"center\":[\"https://rss3\"],\"left\":[\"https://rss4\"]}}";

    const ai = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemma2-9b-it:free',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const result = await ai.json();
    const sources = JSON.parse(result.choices[0].message.content);

    // שמור לpublic/sources.json
    await fetch(`${process.env.VERCEL_URL}/api/write-sources`, {
      method: 'POST',
      body: JSON.stringify(sources)
    });

    // Trigger rebuild
    await fetch(`https://api.vercel.com/v1/deployments/redeploy?projectId=${process.env.VERCEL_PROJECT_ID}&teamId=${process.env.VERCEL_TEAM_ID}`, {
      headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` }
    });

    return NextResponse.json({ updated: sources.feeds.length });
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
}
