import { NextRequest, NextResponse } from 'next/server';
import { generateDebateAudio } from '@/lib/elevenlabs';

interface DebateResponse {
  factAudio: string;
  rightAudio: string;
  leftAudio: string;
  factText: string;
  rightText: string;
  leftText: string;
}

export async function POST(request: NextRequest) {
  try {
    const { title, description } = await request.json();
    
    const debate = await generateDebateAudio(title as string, description as string);
    
    return NextResponse.json(debate as DebateResponse);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate debate audio' }, 
      { status: 500 }
    );
  }
}
