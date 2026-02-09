import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    events: [
      {
        id: 1,
        title: "🧪 Test API - RSS + OpenRouter",
        controversial: true,
        sources: ["iltoday TG", "ynet"],
        facts: ["RSS עובד!", "OpenRouter מוכן"],
        right: "תמיכה מימין",
        left: "ביקורת משמאל"
      }
    ]
  });
}
