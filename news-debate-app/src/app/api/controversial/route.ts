import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    debug: {
      hasOpenRouter: !!process.env.OPENROUTER_KEY,
      keyLength: (process.env.OPENROUTER_KEY?.length || 0) + '',
      envKeys: Object.keys(process.env).filter(k => k.includes('KEY')),
      nextVersion: process.env.NEXT_VERSION || '16',
      status: 'ready'
    }
  });
}
