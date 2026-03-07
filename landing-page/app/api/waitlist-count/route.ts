import { NextResponse } from "next/server";

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME ?? "Waitlist";
const FLOOR = 10; // minimum shown even when real count is lower

export const revalidate = 300; // ISR: revalidate every 5 minutes

export async function GET() {
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    return NextResponse.json({ count: FLOOR });
  }

  try {
    // Fetch only the record IDs — no field data exposed
    const url = new URL(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`
    );
    url.searchParams.set("fields[]", "Email"); // only request one field (minimise data)
    url.searchParams.set("pageSize", "100");

    let total = 0;
    let offset: string | undefined;

    // Page through all records to get the true count
    do {
      if (offset) url.searchParams.set("offset", offset);
      else url.searchParams.delete("offset");

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
        // next.js cache hint — same TTL as revalidate above
        next: { revalidate: 300 },
      });

      if (!res.ok) {
        console.error("Airtable count error:", res.status);
        return NextResponse.json({ count: FLOOR });
      }

      const data = (await res.json()) as { records: unknown[]; offset?: string };
      total += data.records.length;
      offset = data.offset;
    } while (offset);

    const count = Math.max(total, FLOOR);
    return NextResponse.json(
      { count },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" } }
    );
  } catch (err) {
    console.error("Waitlist count error:", err);
    return NextResponse.json({ count: FLOOR });
  }
}
