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
      // עיתונים רגילים
      'https://www.ynet.co.il/Integration/StoryRss2.xml',
      'https://feeds.timesofisrael.com/www.timesofisrael.com/feed', 
      'https://www.haaretz.co.il/rss/homepage',
      'https://www.israelhayom.co.il/rss_main',
      
      // טלגרם RSS שלך
      'https://rss.app/feeds/n2sDVhinP9NLuni7.xml',  // קיים
      'https://t.me/s/iltoday',                       // ישראל היום
      'https://t.me/s/FidYamin',                      // פעילי ימין
      process.env.TG_CHANNEL_RSS || ''                // dynamic
    ].filter(Boolean);  // מסנן ריק

    console.log(`Fetching ${feeds.length} RSS/Telegram feeds...`);

    const results = await Promise.allSettled(
      feeds.map(feed => parser.parseURL(feed))
    );

    const newsItems: NewsItem[] = [];
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.items) {
        console.log(`Feed ${feeds[index]}: ${(result.value.items as any[]).length} items`);
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
      } else {
        console.error(`Feed ${feeds[index]} failed:`, result.status === 'rejected' ? result.reason : 'no items');
      }
    });

    // הסר כפילויות + TOP 5 חדשות
    const uniqueNews = newsItems
      .filter((item, index, self) => 
        index === self.findIndex(n => n.guid === item.guid)
      )
      .sort((a, b) => new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime())
      .slice(0, 5);  // 5 פריטים לOpenRouter!

    console.log(`Returning ${uniqueNews.length} unique hot news items`);
    return uniqueNews;
  } catch (error) {
    console.error('RSS fetch error:', error);
    return [];
  }
}
