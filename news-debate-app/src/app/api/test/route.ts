export async function GET() {
  return Response.json({ status: "API LIVE!", timestamp: new Date().toISOString() });
}
