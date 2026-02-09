import { NextResponse } from 'next/server';
import { fetchHotNews } from '@/lib/rss';

interface NewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
  contentSnippet?: string;
  isoDate: string;
}

export async function GET() {
  try {
    const news = await fetchHotNews();
    return NextResponse.json(news[0] || null);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 });
  }
}
