'use client';

import { useState, useEffect } from 'react';
import { t, translateNews } from '@/lib/translator';

export default function Home() {
  const [news, setNews] = useState<any>(null);
  const [debate, setDebate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<'he' | 'ru' | 'en'>('he');

  useEffect(() => {
    fetchNews();
  }, [lang]);

  const fetchNews = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/news');
      const rawNews = await res.json();
      const translated = await translateNews(rawNews, lang);
      setNews(translated);
    } finally {
      setLoading(false);
    }
  };

  const generateDebate = async () => {
    if (!news) return;
    const res = await fetch('/api/debate', { method: 'POST', body: JSON.stringify(news) });
    setDebate(await res.json());
  };

  if (loading) return <div className="h-screen flex center bg-gradient-to-r from-purple-900 to-blue-900 text-white text-3xl">טוען...</div>;

  return (
    <div dir={lang === 'he' ? 'rtl' : 'ltr'} className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">

      {/* 🔥 Language Selector מתוקן */}
      <div className="max-w-lg mx-auto mb-12">
        <div className="grid grid-cols-3 gap-4 bg-white/10 backdrop-blur-xl rounded-3xl p-6 shadow-2xl border border-white/20">
          {[
            { code: 'he' as const, flag: '🇮🇱', label: 'עברית' },
            { code: 'ru' as const, flag: '🇷🇺', label: 'РУ' },
            { code: 'en' as const, flag: '🇺🇸', label: 'EN' }
          ].map(({ code, flag, label }) => (
            <button
              key={code}
              onClick={() => setLang(code)}
              className={`p-6 rounded-2xl font-bold shadow-lg transition-all hover:shadow-xl hover:-translate-y-1 ${
                lang === code
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-emerald-500/50'
                  : 'bg-white/20 text-white/80 hover:bg-white/40 hover:text-white'
              }`}
            >
              <div className="text-4xl mb-3">{flag}</div>
              <div className="text-lg">{label}</div>
            </button>
          ))}
        </div>
      </div>

      {news && (
        <>
          <div className="max-w-4xl mx-auto mb-12 bg-white/10 backdrop-blur-xl rounded-3xl p-10 border border-white/20 shadow-2xl hover:shadow-white/30 transition-all hover:-translate-y-1">
            <h1 className="text-4xl font-black mb-6 leading-tight">{news.title}</h1>
            <p className="text-xl leading-relaxed mb-6">{news.description}</p>
            <div className="flex justify-between items-center text-white/70 text-lg">
              <span>🕒 {news.pubDate}</span>
              <a href={news.link} target="_blank" className="hover:text-white">🔗 מקור</a>
            </div>
          </div>

          <div className="flex justify-center mb-12">
            <button onClick={generateDebate}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 px-16 py-6 rounded-3xl text-xl font-bold shadow-2xl hover:shadow-emerald-500/50 transition-all hover:scale-[1.05]">
              🎤 הפעל דיון
            </button>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="bg-white/10 backdrop-blur p-8 rounded-3xl border border-white/20 shadow-xl hover:shadow-white/30 hover:-translate-y-2 transition-all">
              <div className="text-5xl mb-6 text-center">📊</div>
              <h2 className="text-3xl font-bold mb-6 text-center">עובדות</h2>
              <p className="text-lg leading-relaxed">{debate?.factText || news.description}</p>
            </div>

            <div className="bg-orange-500/20 backdrop-blur p-8 rounded-3xl border-2 border-orange-400/40 shadow-xl hover:shadow-orange-500/30 hover:-translate-y-2 transition-all">
              <div className="text-5xl mb-6 text-center">🟥</div>
              <h2 className="text-3xl font-bold mb-6 text-center">ימין</h2>
              <p className="whitespace-pre-line text-lg font-semibold">{debate?.rightText}</p>
            </div>

            <div className="bg-blue-500/20 backdrop-blur p-8 rounded-3xl border-2 border-blue-400/40 shadow-xl hover:shadow-blue-500/30 hover:-translate-y-2 transition-all">
              <div className="text-5xl mb-6 text-center">🟦</div>
              <h2 className="text-3xl font-bold mb-6 text-center">שמאל</h2>
              <p className="whitespace-pre-line text-lg font-semibold">{debate?.leftText}</p>
            </div>
          </div>

          <div className="text-center mt-16">
            <button onClick={fetchNews}
              className="bg-white/20 hover:bg-white/30 backdrop-blur border border-white/30 px-12 py-5 rounded-2xl text-xl font-bold text-white shadow-xl hover:shadow-2xl transition-all">
              🔄 רענן ידיעה
            </button>
          </div>
        </>
      )}
    </div>
  );
}
