import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 300;  // cache 5 min on edge

const STOOQ = "https://stooq.com/q/l/?s=alo.fr&i=d&f=sd2t2ohlcv";
const YAHOO = "https://query1.finance.yahoo.com/v8/finance/chart/ALO.PA?range=1y&interval=1d";

type Quote = {
  symbol: "ALO.PA";
  price: number;
  currency: "EUR";
  asOf: string;
  change1y: number;     // fractional, e.g. 0.18 = +18%
  source: "stooq" | "yahoo";
};

async function fromStooq(): Promise<Quote | null> {
  try {
    const res = await fetch(STOOQ, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const csv = await res.text();
    const [, line] = csv.trim().split("\n");
    if (!line) return null;
    const [, date, time, , , , close] = line.split(",");
    const price = Number(close);
    if (!Number.isFinite(price)) return null;
    return { symbol: "ALO.PA", price, currency: "EUR",
             asOf: `${date}T${time}Z`, change1y: 0, source: "stooq" };
  } catch { return null; }
}

async function fromYahoo(): Promise<Quote | null> {
  try {
    const res = await fetch(YAHOO, { next: { revalidate: 300 }, headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return null;
    const j = await res.json();
    const r = j?.chart?.result?.[0];
    const closes: number[] = r?.indicators?.quote?.[0]?.close ?? [];
    const ts: number[] = r?.timestamp ?? [];
    const price = r?.meta?.regularMarketPrice ?? closes.filter(Boolean).at(-1);
    const oneYearAgo = closes.filter(Boolean)[0];
    if (!price || !oneYearAgo) return null;
    return { symbol: "ALO.PA", price, currency: "EUR",
             asOf: new Date(ts.at(-1)! * 1000).toISOString(),
             change1y: (price - oneYearAgo) / oneYearAgo, source: "yahoo" };
  } catch { return null; }
}

export async function GET() {
  const q = (await fromYahoo()) ?? (await fromStooq());
  if (!q) return NextResponse.json({ error: "quote_unavailable" }, { status: 503 });
  return NextResponse.json(q, { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=900" } });
}
