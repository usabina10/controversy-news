import { fetchHotNews } from '../../../lib/rss'; // rss.ts שלך!
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // RSS שלך - ynet + israelhayom!
    const newsItems = await fetchHotNews();
    
    const events = newsItems.slice(0, 3).map(item => ({
      id: item.guid,
      title: item.title,
      right: `פרשנות ימנית: ${item.title.slice(0, 50)}`,
      left: `פרשנות שמאלנית: ${item.title.slice(0, 50)}`,
      sources: ['ynet', 'israelhayom', item.pubDate]
    }));
    
    return NextResponse.json({ events });
  } catch (error) {
    return NextResponse.json({ 
      events: [{
        title: `RSS error: ${error}`,
        right: "טכני",
        left: "טכני"
      }]
    });
  }
}
