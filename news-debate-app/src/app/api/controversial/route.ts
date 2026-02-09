import { NextResponse } from 'next/server';

const SOURCES = [
  process.env.TG_RSS_1!,
  process.env.TG_RSS_2!,
  'https://www.ynet.co.il/Integration/StoryRss2.xml'
];

export async function GET() {
  try {
    // RSS fetch
    const rssData = await Promise.all(SOURCES.map(async (url) => {
      const res = await fetch(url);
      return await res.text();
    }));

    // OpenRouter analyze
    const analysis = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.1-70b-instruct:free',
        messages: [{
          role: 'user',
          content: `נתח ידיעות מ-${SOURCES.join(', ')}:
          רק controversial ישראליות. TOP 5 JSON: {events: [{title, controversial, bias_split}]}` 
        }]
      })
    });

    const result = await analysis.json();
    return NextResponse.json({ events: result.choices[0].message.content });
  } catch (error) {
    return NextResponse.json({ events: [], error: error.message });
  }
}
