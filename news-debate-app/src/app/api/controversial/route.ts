export async function POST() {
  try {
    const prompt = `אתר מקורות חדשות פוליטיות ישראליות עם הטיה:
- ימין: ישראל היום, ערוץ 14 RSS
- מרכז: ynet, Times of Israel  
- שמאל: הארץ, כאן 11

החזר JSON:
{
  "feeds": {
    "right": ["https://...", "https://..."],
    "center": [...],
    "left": [...]
  }
}`;

    const ai = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemma2-9b-it:free',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const result = await ai.json();
    const sources = JSON.parse(result.choices[0].message.content);

    // שמור לpublic/sources.json
    await fetch(`${process.env.VERCEL_URL}/api/write-sources`, {
      method: 'POST',
      body: JSON.stringify(sources)
    });

    // Trigger rebuild
    await fetch(`https://api.vercel.com/v1/deployments/redeploy?projectId=${process.env.VERCEL_PROJECT_ID}&teamId=${process.env.VERCEL_TEAM_ID}`, {
      headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` }
    });

    return NextResponse.json({ updated: sources.feeds.length });
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
}
