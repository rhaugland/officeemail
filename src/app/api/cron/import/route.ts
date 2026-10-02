import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { contacts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const TARGET_TITLES = [
  "Chief Human Resources Officer",
  "Chief People Officer",
  "CHRO",
  "CPO",
  "VP of Human Resources",
  "VP of People",
  "SVP of Human Resources",
  "SVP of People",
];

const TARGET_STATES = [
  "Minnesota",
  "Iowa",
  "Michigan",
  "Wisconsin",
  "Ohio",
  "Indiana",
  "South Dakota",
  "North Dakota",
  "Colorado",
  "Arizona",
  "Nevada",
  "Utah",
];

async function enrichPerson(apiKey: string, apolloId: string) {
  const res = await fetch("https://api.apollo.io/v1/people/match", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify({ id: apolloId }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.person || null;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Apollo API key not configured" }, { status: 500 });
  }

  let totalImported = 0;
  let totalSkipped = 0;
  let totalEnrichFailed = 0;
  let totalEnriched = 0;
  let page = 1;
  const maxEnrichPerRun = 100;

  while (totalEnriched < maxEnrichPerRun) {
    const response = await fetch("https://api.apollo.io/v1/mixed_people/api_search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify({
        person_titles: TARGET_TITLES,
        organization_num_employees_ranges: ["25,2500"],
        person_locations: TARGET_STATES.map((s) => `${s}, United States`),
        page,
        per_page: 50,
      }),
    });

    if (!response.ok) break;

    const data = await response.json();
    const people = data.people || [];
    if (people.length === 0) break;

    for (const person of people) {
      if (totalEnriched >= maxEnrichPerRun) break;

      if (!person.id) {
        totalSkipped++;
        continue;
      }

      // Skip if we already have this Apollo contact (saves credits)
      const alreadyHave = await getDb()
        .select({ id: contacts.id })
        .from(contacts)
        .where(eq(contacts.apolloId, person.id))
        .limit(1);

      if (alreadyHave.length > 0) {
        totalSkipped++;
        continue;
      }

      totalEnriched++;
      const enriched = await enrichPerson(apiKey, person.id);
      if (!enriched?.email) {
        totalEnrichFailed++;
        continue;
      }

      const existing = await getDb()
        .select({ id: contacts.id })
        .from(contacts)
        .where(eq(contacts.email, enriched.email))
        .limit(1);

      if (existing.length > 0) {
        totalSkipped++;
        continue;
      }

      await getDb().insert(contacts).values({
        firstName: enriched.first_name || "",
        lastName: enriched.last_name || "",
        email: enriched.email,
        phone: enriched.phone_numbers?.[0]?.sanitized_number || enriched.organization?.phone || null,
        title: enriched.title || "",
        companyName: enriched.organization?.name || "",
        companySize: enriched.organization?.estimated_num_employees || null,
        companyLocation: enriched.city
          ? `${enriched.city}, ${enriched.state}`
          : "",
        industry: enriched.organization?.industry || "",
        apolloId: enriched.id || null,
      });
      totalImported++;

      await new Promise((r) => setTimeout(r, 200));
    }

    page++;
  }

  return NextResponse.json({
    imported: totalImported,
    skipped: totalSkipped,
    enrichFailed: totalEnrichFailed,
    pagesScanned: page - 1,
  });
}
