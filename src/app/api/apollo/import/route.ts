import { NextResponse } from "next/server";
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

export async function POST(request: Request) {
  const { page = 1 } = await request.json().catch(() => ({ page: 1 }));

  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Apollo API key not configured" }, { status: 500 });
  }

  const response = await fetch("https://api.apollo.io/v1/mixed_people/search", {
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

  if (!response.ok) {
    const error = await response.text();
    return NextResponse.json({ error: `Apollo API error: ${error}` }, { status: response.status });
  }

  const data = await response.json();
  const people = data.people || [];
  let imported = 0;
  let skipped = 0;

  for (const person of people) {
    if (!person.email) {
      skipped++;
      continue;
    }

    const existing = await getDb()
      .select({ id: contacts.id })
      .from(contacts)
      .where(eq(contacts.email, person.email))
      .limit(1);

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    await getDb().insert(contacts).values({
      firstName: person.first_name || "",
      lastName: person.last_name || "",
      email: person.email,
      title: person.title || "",
      companyName: person.organization?.name || "",
      companySize: person.organization?.estimated_num_employees || null,
      companyLocation: person.organization?.city
        ? `${person.organization.city}, ${person.organization.state}`
        : "",
      industry: person.organization?.industry || "",
      apolloId: person.id || null,
    });
    imported++;
  }

  return NextResponse.json({
    imported,
    skipped,
    total: people.length,
    pagination: data.pagination || {},
  });
}
