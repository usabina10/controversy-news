'use client';
import { useState, useEffect } from 'react';

interface NewsItem {
  id: string;
  title: string;
  link: string;
  sourceName: string;
  author?: string;
  pubDate?: string;
  bias: 'right' | 'left' | 'center';
  origin: string;
}

export default function Home() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/controversial')
      .then(r => r.json())
      .then((data) => {
        setNews(data.newsItems || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Fetch error:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white">
        <div className="animate-pulse">מתחבר למקורות החדשות... 🔄</div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-slate-900 to-black text-white p-4 md:p-8">
      <header className="max-w-6xl mx-auto text-center mb-12">
        <h1 className="text-4xl md:text-6xl font-black mb-4 bg-gradient-to-r from-red-500 via-white to-blue-500 bg-clip-text text-transparent">
          Controversy News
        </h1>
        <p className="opacity-70 text-lg">ניתוח הטיה פוליטית מבוסס AI בזמן אמת</p>
      </header>

      <div className="grid gap-6 max-w-5xl mx-auto">
        {news.length > 0 ? (
          news.map((item) => (
            <div 
              key={item.id || item.link} 
              className={`group bg-white/5 backdrop-blur-md rounded-2xl p-6 border transition-all duration-300 hover:scale-[1.01] ${
                item.bias === 'right' ? 'border-red-500/30 hover:shadow-[0_0_20px_rgba(239,68,68,0.1)]' :
                item.bias === 'left' ? 'border-blue-500/30 hover:shadow-[0_0_20px_rgba(59,130,246,0.1)]' :
                'border-gray-500/30 hover:shadow-[0_0_20px_rgba(156,163,175,0.1)]'
              }`}
            >
              <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase ${
                      item.bias === 'right' ? 'bg-red-500/20 text-red-400' :
                      item.bias === 'left' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {item.bias === 'right' ? 'ימין' : item.bias === 'left' ? 'שמאל' : 'מרכז'}
                    </span>
                    <span className="text-xs opacity-50">{item.sourceName}</span>
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold leading-tight group-hover:text-blue-400 transition-colors">
                    {item.title}
                  </h2>
                </div>

                {item.link && (
                  <a 
                    href={item.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="bg-white/10 hover:bg-white/20 p-3 rounded-xl transition-colors shrink-0"
                  >
                    🔗
                  </a>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between text-sm opacity-60">
                <div className="flex gap-4">
                  {item.author && <span>כתב: <strong>{item.author}</strong></span>}
                  <span>מקור: <strong>{item.origin}</strong></span>
                </div>
                {item.pubDate && (
                  <span>{new Date(item.pubDate).toLocaleDateString('he-IL')}</span>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-20 opacity-50 border-2 border-dashed border-white/10 rounded-3xl">
            לא נמצאו חדשות כרגע. נסה לרענן בעוד דקה.
          </div>
        )}
      </div>

      <footer className="max-w-6xl mx-auto mt-20 text-center pb-10">
        <button 
          onClick={() => window.location.reload()}
          className="bg-white text-black px-8 py-3 rounded-full font-bold hover:bg-gray-200 transition-all shadow-xl"
        >
          רענן עדכון
        </button>
      </footer>
    </div>
  );
}
