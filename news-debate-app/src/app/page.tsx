'use client';
import { useState, useEffect } from 'react';

interface Event {
  id: string;
  title: string;
  right?: string;
  center?: string;
  left?: string;
  sources?: string[];
  link?: string;
  pubDate?: string;
}

export default function Home() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedsCount, setFeedsCount] = useState(0);

  useEffect(() => {
    fetch('/api/controversial')
      .then(r => r.json())
      .then((data: any) => {
        console.log('📡 API data:', data); // Debug
        setEvents(Array.isArray(data.events) ? data.events : data.newsItems || []);
        setFeedsCount(
          (data.feeds?.right?.length || 0) + 
          (data.feeds?.center?.length || 0) + 
          (data.feeds?.left?.length || 0)
        );
        setLoading(false);
      })
      .catch(err => {
        console.error('Fetch error:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-blue-900 to-black text-white">
        <div>טוען חדשות... 🔄</div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-blue-900 via-purple-900 to-black text-white p-8">
      <h1 className="text-5xl font-black text-center mb-4 bg-gradient-to-r from-red-400 via-yellow-400 to-blue-400 bg-clip-text text-transparent">
        📰 Controversy News
      </h1>
      <p className="text-center mb-12 opacity-80 text-xl">
        מקורות דינמיים: <strong>{feedsCount}</strong> | ידיעות: <strong>{events.length}</strong>
      </p>
      
      <div className="grid gap-8 max-w-6xl mx-auto">
        {events.map(event => (
          <div key={event.id || event.title} className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20 hover:border-white/40 transition-all shadow-2xl hover:shadow-3xl">
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <h2 className="text-3xl font-bold flex-1 leading-tight">{event.title}</h2>
              {event.link && (
                <a 
                  href={event.link} 
                  target="_blank" 
                  className="bg-white/20 hover:bg-white/30 px-6 py-3 rounded-2xl font-bold whitespace-nowrap"
                >
                  🔗 מקור
                </a>
              )}
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-red-500/20 p-6 rounded-2xl border border-red-500/30 hover:bg-red-500/30 transition-all">
                <h3 className="text-xl font-bold text-red-400 mb-3">🟥 ימין</h3>
                <p className="text-lg">{event.right || 'פרשנות תקיפה – Israel Hayom'}</p>
              </div>
              
              <div className="bg-gray-500/20 p-6 rounded-2xl border border-gray-500/30 hover:bg-gray-500/30 transition-all">
                <h3 className="text-xl font-bold text-gray-300 mb-3">⚪ מרכז</h3>
                <p className="text-lg">{event.center || 'דיווח מאוזן – Ynet'}</p>
              </div>
              
              <div className="bg-blue-500/20 p-6 rounded-2xl border border-blue-500/30 hover:bg-blue-500/30 transition-all">
                <h3 className="text-xl font-bold text-blue-400 mb-3">🟦 שמאל</h3>
                <p className="text-lg">{event.left || 'ביקורת מעמיקה – Haaretz'}</p>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-white/20 flex flex-wrap gap-2 text-sm opacity-75">
              <span>מקורות: {event.sources?.join(', ') || 'RSS דינמי'}</span>
              {event.pubDate && <span>🕒 {new Date(event.pubDate).toLocaleString('he-IL')}</span>}
            </div>
          </div>
        ))}
      </div>
      
      {events.length === 0 && (
        <div className="text-center mt-20 opacity-50">
          <p className="text-2xl mb-4">אין חדשות זמינות כרגע</p>
          <p>F12 → Console → בדוק /api/controversial</p>
        </div>
      )}
      
      <button 
        onClick={() => window.location.reload()} 
        className="mt-16 mx-auto block bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white px-12 py-4 rounded-3xl text-xl font-bold shadow-2xl hover:shadow-3xl transition-all"
      >
        🔄 רענן חדשות
      </button>
    </div>
  );
}
