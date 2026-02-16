import { NextResponse } from 'next/server';
import { fetchHotNews } from '@/lib/rss';
import { Redis } from '@upstash/redis';

export const dynamic = 'force-dynamic';

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const AI_PROMPT = `Analyze the political bias of the following Israeli news entities (right, center, left). Return ONLY a JSON object: {"name": "bias"}. Entities: `;

export async function GET() {
  try {
    // בדיקה מהירה: האם Redis עובד?
    await redis.set("debug_connection", "ok_" + new Date().getTime());

    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${process.env.OPENROUTER_KEY}`, 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.2-3b-instruct:free', 
        messages: [{ role: 'user', content: 'Return JSON: {"test": "right"}' }]
      })
    });

    const aiData = await aiRes.json();

    return NextResponse.json({ 
      redis_check: "Check REPL for debug_connection",
      ai_status: aiRes.status,
      ai_response: aiData 
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message });
  }
}

