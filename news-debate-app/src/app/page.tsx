'use client';
import { useState, useEffect } from 'react';

interface Event {
  id: string;
  title: string;
  right?: string;
  center?: string;
  left?: string;
  sources?: string[];
}

export default function Home() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedsCount, setFeedsCount] = useState(0);

  useEffect(() => {
    fetch('/api/controversial')
      .then(r => r.json())
      .then((data: any) => {
        setEvents(Array.isArray(data.events) ? data.events : data.newsItems || []);
        setFeedsCount(
          (data.feeds?.right?.length || 0) + 
          (data.feeds?.center?.length || 0) + 
          (data.feeds?.left?.length || 0)
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-screen text-white">טוען חדשות...</div>;

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-blue-900 to-black text-white p-8 font-hebrew">
      <h1 className="text-4xl font-bold text-center mb-8">📰 Controversy News</h1>
      <p className="text-center mb-8 opacity-75">
        מקורות דינמיים: {feedsCount} | ידיעות: {events.length}
      </p>
      <div className="grid gap-6 max-w-4xl mx-auto">
        {events.map(event => (
          <div key={event.id || event.title} className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold mb-2">{event.title}</h2>
            <div className="grid md:grid-cols-3 gap-4 mt-4">
              <div className="bg-red-500/20 p-4 rounded-xl">
                <h3 className="font-bold text-red-400 mb-2">🟥 ימין</h3>
                <p>{event.right || 'פרשנות תקיפה'}</p>
              </div>
              <div className="bg-gray-500/20 p-4 rounded-xl">
                <h3 className="font-bold text-gray-400 mb-2">⚪ מרכז</h3>
                <p>{event.center || 'דיווח מאוזן'}</p>
              </div>
              <div className="bg-blue-500/20 p-4 rounded-xl">
                <h3 className="font-bold text-blue-400 mb-2">🟦 שמאל</h3>
                <p>{event.left || 'ביקורת מעמיקה'}</p>
              </div>
            </div>
            <p className="text-sm opacity-75 mt-4">
              מקורות: {event.sources?.join(', ') || 'RSS דינמי'}
            </p>
          </div>
        ))}
      </div>
      {events.length === 0 && (
        <p className="text-center mt-8 opacity-50 text-xl">
          אין חדשות זמינות. בדוק <code>/api/controversial</code> ב-DevTools.
        </p>
      )}
      <button 
        onClick={() => window.location.reload()} 
        className="mt-12 mx-auto block bg-white/20 hover:bg-white/30 px-8 py-4 rounded-xl transition-all"
      >
        🔄 רענן חדשות
      </button>
    </div>
  );
}
