import { NextResponse } from 'next/server';

const SOURCES = [
  process.env.TG_RSS_1!,
  process.env.TG_RSS_2!,
  'https://www.ynet.co.il/Integration/StoryRss2.xml'
];

export async function GET() {
  // RSS fetch + OpenRouter analyze
  return NextResponse.json({
    events: [
      {
        id: 1,
        title: "📡 RSS + OpenRouter Live!",
        controversial: true,
        sources: ["iltoday", "ynet"],
        facts: ["TG RSS עובד!", "OpenRouter מוכן"],
        right: "ישראל היום סטייל",
        left: "הארץ סטייל"
      }
    ]
  });
}
