import Parser from 'rss-parser';
const parser = new Parser();

export async function fetchTelegramRSS() {
  const telegramFeeds = [
    { 
      name: 'Telegram Channel', 
      url: 'https://rss.app/feeds/n2sDVhinP9NLuni7.xml' 
    }
  ];

  try {
    const results = await Promise.all(
      telegramFeeds.map(feed => 
        parser.parseURL(feed.url)
          .then(res => res.items.map(item => ({
            id: item.guid || item.link || Math.random().toString(),
            title: item.title || 'Telegram Update',
            link: item.link || '#',
            pubDate: item.isoDate || item.pubDate || new Date().toISOString(),
            sourceName: feed.name,
            author: 'Telegram'
          })))
          .catch(err => {
            console.error(`RSS Error for ${feed.name}:`, err);
            return [];
          })
      )
    );
    return results.flat();
  } catch (err) {
    console.error("RSS Fetch Error:", err);
    return [];
  }
}
