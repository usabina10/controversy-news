'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedsCount, setFeedsCount] = useState(0);

  useEffect(() => {
    fetch('/api/controversial')
      .then(r => r.json())
      .then(data => {
        setEvents(data.events || data.newsItems || []);
        setFeedsCount(data.feeds?.right?.length + data.feeds?.center?.length + data.feeds?.left?.length || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-screen">טוען חדשות...</div>;

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-blue-900 to-black text-white p-8">
      <h1 className="text-4xl font-bold text-center mb-8">📰 Controversy News</h1>
      <p className="text-center mb-8 opacity-75">מקורות: {feedsCount} דינמיים | ידיעות: {events.length}</p>
      <div className="grid gap-6 max-w-4xl mx-auto">
        {events.map(event => (
          <div key={event.id} className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold mb-2">{event.title}</h2>
            <div className="grid md:grid-cols-3 gap-4 mt-4">
              <div className="bg-red-500/20 p-4 rounded-xl">
                <h3 className="font-bold text-red-400">🟥 ימין</h3>
                <p>{event.right || 'ישראל היום: פרשנות תקיפה'}</p>
              </div>
              <div className="bg-gray-500/20 p-4 rounded-xl">
                <h3 className="font-bold text-gray-400">⚪ מרכז</h3>
                <p>{event.center || 'Ynet: דיווח מאוזן'}</p>
              </div>
              <div className="bg-blue-500/20 p-4 rounded-xl">
                <h3 className="font-bold text-blue-400">🟦 שמאל</h3>
                <p>{event.left || 'הארץ: ביקורת מעמיקה'}</p>
              </div>
            </div>
            <p className="text-sm opacity-75 mt-4">מקורות: {event.sources?.join(', ') || 'RSS'}</p>
          </div>
        ))}
      </div>
      {events.length === 0 && <p className="text-center mt-8 opacity-50">אין חדשות זמינות. בדוק API logs.</p>}
      <button 
        onClick={() => window.location.reload()} 
        className="mt-12 mx-auto block bg-white/20 hover:bg-white/30 px-8 py-4 rounded-xl"
      >
        🔄 רענן
      </button>
    </div>
  );
}


