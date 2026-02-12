
import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';

export async function GET() {
  const sources = {
    feeds: {
      right: ["https://www.israelhayom.co.il/rss_main"],
      center: ["https://www.ynet.co.il/Integration/StoryRss2.xml"],
      left: ["https://www.haaretz.co.il/rss/homepage"]
    }
  };

  await writeFile('./public/sources.json', JSON.stringify(sources, null, 2));
  return NextResponse.json({ success: true, updated: 6 });
}
