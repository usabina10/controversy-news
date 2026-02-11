import { NextResponse } from 'next/server';

export async function GET() {
  const debug = {
    hasOpenRouter: !!process.env.OPENROUTER_KEY,
    keyLength: (process.env.OPENROUTER_KEY?.length || 0) + '',
    envKeys: Object.keys(process.env).filter(k => k.includes('KEY')),
    nextVersion: '16',
    status: 'ok'
  };

  const events = [
    {
      id: 1,
      title: '✅ Debug API works',
      right: 'ימין: הכל בסדר',
      left: 'שמאל: צריך עוד בדיקות',
      sources: ['debug']
    }
  ];

  return NextResponse.json({ debug, events });
}
