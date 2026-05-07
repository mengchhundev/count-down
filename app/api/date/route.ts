import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const KEY = "weddingDate";

export async function GET() {
  const date = await redis.get<string>(KEY);
  return Response.json({ date: date ?? null });
}

export async function POST(req: Request) {
  const { date } = await req.json();
  if (!date || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: "Invalid date" }, { status: 400 });
  }
  await redis.set(KEY, date);
  return Response.json({ ok: true });
}
