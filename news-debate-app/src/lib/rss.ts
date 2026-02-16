import Parser from 'rss-parser';
const parser = new Parser();

export async function fetchTelegramRSS() {
  const feeds = [
    { name: 'ערוץ 7', url: 'https://www.inn.co.il/Rss.aspx' },
    { name: 'ישראל היום', url: 'https://www.israelhayom.co.il/rss.xml' },
    { name: 'מעריב', url: 'https://www.maariv.co.il/Rss/RssFeeds0.aspx' },
    { name: 'הארץ', url: 'https://www.haaretz.co.il/cmlink/1.147048' }
  ];

  try {
    const results = await Promise.all(
      feeds.map(feed => 
        parser.parseURL(feed.url)
          .then(res => res.items.map(item => ({
            id: item.guid || item.link || Math.random().toString(),
            title: item.title || '',
            link: item.link || '',
            pubDate: item.isoDate || item.pubDate || new Date().toISOString(),
            sourceName: feed.name,
            author: feed.name // נשלח את שם המקור ל-AI כדי שיסווג
          })))
          .catch(err => {
            console.error(`Failed to fetch ${feed.name}:`, err.message);
            return [];
          })
      )
    );
    
    return results.flat();
  } catch (err) {
    console.error("General RSS Error:", err);
    return [];
  }
}
