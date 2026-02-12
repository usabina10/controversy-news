import Parser from 'rss-parser';

interface NewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
  contentSnippet?: string;
  isoDate: string;
}

const parser = new Parser({
  customFields: { item: ['contentSnippet', 'isoDate'] }
});

// סטטי: תמיד זמין
const STATIC_FEEDS = [
  'https://www.ynet.co.il/Integration/StoryRss2.xml',
  'https://www.israelhayom.co.il/rss_main',
  'https://rss.app/feeds/n2sDVhinP9NLuni7.xml'  // טלגרם שלך
];

export async function fetchHotNews(): Promise<NewsItem[]> {
  try {
    // 1. דינמי: sources.json (AI cron)
    let dynamicFeeds: string[] = [];
    try {
      const res = await fetch(`${process.env.VERCEL_URL}/sources.json`);
      if (res.ok) {
        const sources = await res.json();
        dynamicFeeds = [
          ...sources.feeds.right,
          ...sources.feeds.center, 
          ...sources.feeds.left
        ].slice(0, 10);  // max 10
      }
    } catch {}

    // 2. כל הfeeds
    const allFeeds = [...dynamicFeeds, ...STATIC_FEEDS];
    console.log(`📡 ${allFeeds.length} feeds: ${allFeeds.length - STATIC_FEEDS.length} dynamic`);

    // 3. Parse parallel
    const results = await Promise.allSettled(
      allFeeds.map(feed => parser.parseURL(feed))
    );

    const newsItems: NewsItem[] = [];
    results.forEach((result, i) => {
      if (result.status === 'fulfilled' && result.value.items) {
        (result.value.items as any[]).slice(0, 3).forEach(item => {
          if (item.title && item.link) {
            newsItems.push({
              title: item.title.trim(),
              link: item.link,
              description: item.contentSnippet || item.description || '',
              pubDate: new Date(item.pubDate || Date.now()).toLocaleString('he-IL'),
              guid: item.guid || item.link!,
              contentSnippet: item.contentSnippet,
              isoDate: item.isoDate || item.pubDate || new Date().toISOString()
            });
          }
        });
      }
    });

    // 4. TOP 5 unique
    return newsItems
      .filter((item, idx, self) => idx === self.findIndex(n => n.guid === item.guid))
      .sort((a, b) => new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime())
      .slice(0, 5);

  } catch (error) {
    console.error('RSS error:', error);
    return [];
  }
}
