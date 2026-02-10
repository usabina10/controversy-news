'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function Home() {
  const pathname = usePathname();
  const [events, setEvents] = useState([]);
  
  useEffect(() => {
    fetch('/api/controversial')
      .then(res => res.json())
      .then(data => setEvents(data.events || []));
  }, []);

  return (
    <div style={{padding: '2rem', maxWidth: '800px', margin: '0 auto'}}>
      <h1>📰 Controversy News Debate</h1>
      <p>Path: <code>{pathname}</code></p>
      
      <div style={{display: 'grid', gap: '1rem'}}>
        {events.map((event: any) => (
          <div key={event.id} style={{
            border: '1px solid #ccc', padding: '1rem', borderRadius: '8px'
          }}>
            <h3>{event.title}</h3>
            <p><strong>ימין:</strong> {event.right}</p>
            <p><strong>שמאל:</strong> {event.left}</p>
            <p><em>עובדות:</em> {event.facts?.join(', ')}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

