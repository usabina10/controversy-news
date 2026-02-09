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
  customFields: {
    item: ['contentSnippet', 'isoDate']
  }
});

export async function fetchHotNews(): Promise<NewsItem[]> {
  try {
    const feeds = [
      'https://www.ynet.co.il/Integration/StoryRss2.xml',
      'https://feeds.timesofisrael.com/www.timesofisrael.com/feed',
      'https://www.haaretz.co.il/rss/homepage',
      'https://www.israelhayom.co.il/rss_main'
    ];

    const results = await Promise.allSettled(
      feeds.map(feed => parser.parseURL(feed))
    );

    const newsItems: NewsItem[] = [];
    
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.items) {
        (result.value.items as any[]).slice(0, 3).forEach(item => {
          if (item.title && item.link && item.pubDate) {
            newsItems.push({
              title: item.title,
              link: item.link,
              description: item.contentSnippet || item.description || '',
              pubDate: new Date(item.pubDate).toLocaleString('he-IL'),
              guid: item.guid || item.link,
              contentSnippet: item.contentSnippet,
              isoDate: item.isoDate || item.pubDate
            });
          }
        });
      }
    });

    // הסר כפילויות + סדר לפי חדשות
    const uniqueNews = newsItems
      .filter((item, index, self) => 
        index === self.findIndex(n => n.guid === item.guid)
      )
      .sort((a, b) => new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime())
      .slice(0, 1);

    return uniqueNews;
  } catch (error) {
    console.error('RSS fetch error:', error);
    return [];
  }
}
