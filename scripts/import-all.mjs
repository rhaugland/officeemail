import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
const API_KEY = process.env.APOLLO_API_KEY;

const TARGET_TITLES = [
  'Chief Human Resources Officer', 'Chief People Officer', 'CHRO', 'CPO',
  'VP of Human Resources', 'VP of People', 'SVP of Human Resources', 'SVP of People'
];
const TARGET_STATES = [
  'Minnesota', 'Iowa', 'Michigan', 'Wisconsin', 'Ohio', 'Indiana',
  'South Dakota', 'North Dakota', 'Colorado', 'Arizona', 'Nevada', 'Utah'
];

async function enrichPerson(apolloId) {
  const res = await fetch('https://api.apollo.io/v1/people/match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': API_KEY },
    body: JSON.stringify({ id: apolloId }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.person || null;
}

let page = 1;
let totalImported = 0;
let totalSkipped = 0;
let totalEnrichFailed = 0;

while (true) {
  console.log(`Fetching page ${page}...`);
  const res = await fetch('https://api.apollo.io/v1/mixed_people/api_search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': API_KEY },
    body: JSON.stringify({
      person_titles: TARGET_TITLES,
      organization_num_employees_ranges: ['25,2500'],
      person_locations: TARGET_STATES.map(s => `${s}, United States`),
      page,
      per_page: 100,
    }),
  });

  if (!res.ok) {
    console.log('API error:', res.status, await res.text());
    break;
  }

  const data = await res.json();
  const people = data.people || [];
  if (people.length === 0) break;

  for (const p of people) {
    if (!p.id) { totalSkipped++; continue; }

    const enriched = await enrichPerson(p.id);
    if (!enriched?.email) {
      totalEnrichFailed++;
      continue;
    }

    const existing = await sql`SELECT id FROM contacts WHERE email = ${enriched.email} LIMIT 1`;
    if (existing.length > 0) { totalSkipped++; continue; }

    const loc = enriched.city ? `${enriched.city}, ${enriched.state}` : '';
    await sql`INSERT INTO contacts (first_name, last_name, email, title, company_name, company_size, company_location, industry, apollo_id, status)
      VALUES (${enriched.first_name || ''}, ${enriched.last_name || ''}, ${enriched.email}, ${enriched.title || ''}, ${enriched.organization?.name || ''}, ${enriched.organization?.estimated_num_employees || null}, ${loc}, ${enriched.organization?.industry || ''}, ${enriched.id || null}, 'new')`;
    totalImported++;
    console.log(`  + ${enriched.first_name} ${enriched.last_name} (${enriched.email})`);

    // Rate limit enrichment
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`Page ${page}: ${people.length} results, ${totalImported} imported, ${totalEnrichFailed} no email`);
  page++;

  // Rate limit between pages
  await new Promise(r => setTimeout(r, 1000));
}

console.log(`Done! Imported: ${totalImported}, Skipped: ${totalSkipped}, No email: ${totalEnrichFailed}, Pages: ${page - 1}`);
