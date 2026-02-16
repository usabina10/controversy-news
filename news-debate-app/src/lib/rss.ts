import Parser from 'rss-parser';
const parser = new Parser();

// שימי לב לשם הפונקציה - הוא חייב להיות fetchTelegramRSS
export async function fetchTelegramRSS() {
  const telegramFeeds = [
    // כאן תשימי את ה-URLים של ה-RSS עבור ערוצי הטלגרם
    {https://rss.app/feeds/n2sDVhinP9NLuni7.xml }
    
  ];

  try {
    const results = await Promise.all(
      telegramFeeds.map(feed => 
        parser.parseURL(feed.url)
          .then(res => res.items.map(item => ({
            id: item.guid || item.link,
            title: item.title,
            link: item.link,
            pubDate: item.isoDate || item.pubDate,
            sourceName: feed.name,
            author: 'Telegram'
          })))
          .catch(() => [])
      )
    );
    return results.flat();
  } catch (err) {
    console.error("RSS Fetch Error:", err);
    return [];
  }
}
