import { fetchHotNews } from '../../../lib/rss';
import { NextResponse } from 'next/server';

export async function GET() {
  const newsItems = await fetchHotNews();
  
  // OpenRouter bias split
  const openrouter = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.1-70b-instruct:free',
      messages: [{
        role: 'user',
        content: `חדשות: ${newsItems.map(n => n.title).join('\n')}
        debate JSON: {events: [{title, right:"ישראל היום", left:"הארץ", controversial:true}]}`
      }]
    })
  });
  
  const result = await openrouter.json();
  const aiEvents = JSON.parse(result.choices[0]?.message?.content || '[]');
  
  return NextResponse.json({ events: aiEvents.length ? aiEvents : newsItems.map(item => ({
    id: item.guid,
    title:
