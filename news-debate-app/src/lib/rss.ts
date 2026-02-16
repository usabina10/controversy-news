import Parser from 'rss-parser';
const parser = new Parser();

export async function fetchTelegramRSS() {
  const feeds = [
    { 
      name: 'פיד ימין (טלגרם)', 
      url: 'https://rsshub.bubbletea.com.hk/telegram/channel/fidyamin' 
    }
  ];

  try {
    const results = await Promise.all(
      feeds.map(feed => 
        parser.parseURL(feed.url)
          .then(res => res.items.map(item => ({
            id: item.guid || item.link || Math.random().toString(),
            title: item.title || 'עדכון מפיד ימין',
            link: item.link || '#',
            // RSSHub לפעמים מחזיר תאריך בפורמט מעט שונה, נוודא תקינות:
            pubDate: item.isoDate || item.pubDate || new Date().toISOString(),
            sourceName: feed.name,
            author: 'ימין' // סיווג ידני ראשוני למקרה שה-AI יפספס
          })))
          .catch(err => {
            console.error(`RSS Error for ${feed.name}:`, err);
            return []; // מחזיר מערך ריק כדי לא להכשיל את שאר המקורות
          })
      )
    );
    
    return results.flat();
  } catch (err) {
    console.error("General RSS Fetch Error:", err);
    return [];
  }
}
