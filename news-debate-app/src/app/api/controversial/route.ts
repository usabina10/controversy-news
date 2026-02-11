export async function GET() {
  console.log('ENV:', !!process.env.OPENROUTER_KEY);
  
  if (!process.env.OPENROUTER_KEY) {
    return NextResponse.json({ 
      debug: 'No OPENROUTER_KEY in Vercel runtime',
      hasKey: !!process.env.OPENROUTER_KEY 
    });
  }
  // ... שאר קוד
}
