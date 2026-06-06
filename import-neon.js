const { Client } = require('pg');
const fs = require('fs');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://neondb_owner:npg_4vXy1QsJSjeL@ep-muddy-hall-aooxzt1n.c-2.ap-southeast-1.aws.neon.tech/neondb',
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('Connected to Neon ✓');

  const csv = fs.readFileSync('properties.csv', 'utf8');
  const lines = csv.split('\n').filter(l => l.trim());

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const dataRows = lines.slice(1);

  // Columns that must never be null — use '' as fallback
  const NOT_NULL_DEFAULTS = {
    imageUrl: '',
    title: 'Untitled',
    description: '',
    city: '',
    location: '',
    source: '',
    sourceUrl: '',
  };

  console.log(`Columns: ${headers.join(', ')}`);
  console.log(`Rows to insert: ${dataRows.length}`);

  function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        values.push(current === '' ? null : current);
        current = '';
      } else {
        current += ch;
      }
    }
    values.push(current === '' ? null : current);
    return values;
  }

  const BATCH = 50;
  const colList = headers.map(c => `"${c}"`).join(', ');
  let skipped = 0;

  for (let i = 0; i < dataRows.length; i += BATCH) {
    const batch = dataRows.slice(i, i + BATCH)
      .map(parseCSVLine)
      .filter(row => row.length === headers.length)
      .map(row =>
        row.map((val, ci) => {
          const col = headers[ci];
          // Replace null with default for NOT NULL columns
          if (val === null && NOT_NULL_DEFAULTS[col] !== undefined) {
            return NOT_NULL_DEFAULTS[col];
          }
          return val;
        })
      );

    if (batch.length === 0) { skipped++; continue; }

    const placeholders = batch.map((_, ri) =>
      `(${headers.map((_, ci) => `$${ri * headers.length + ci + 1}`).join(', ')})`
    ).join(', ');

    try {
      await client.query(
        `INSERT INTO properties (${colList}) VALUES ${placeholders} ON CONFLICT (id) DO NOTHING`,
        batch.flat()
      );
    } catch (err) {
      console.error(`\nBatch ${i}-${i+BATCH} failed: ${err.message}`);
    }

    process.stdout.write(`\rInserted ${Math.min(i + BATCH, dataRows.length)} / ${dataRows.length}`);
  }

  const { rows } = await client.query('SELECT COUNT(*) FROM properties;');
  console.log(`\n✓ Done! Properties in Neon: ${rows[0].count}`);
  if (skipped) console.log(`  (${skipped} malformed rows skipped)`);
  await client.end();
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });