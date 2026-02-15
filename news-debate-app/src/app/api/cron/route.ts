import { NextResponse } from 'next/server';

export async function GET() {
  console.log('🕐 Cron running!');
  
  // RSS update logic כאן (בלי sources.json)
  
  return NextResponse.json({ 
    status: 'success', 
    timestamp: new Date().toISOString(),
    message: 'Cron completed!' 
  });
}
