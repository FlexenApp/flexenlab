const fs = require('fs');
const fetch = require('node-fetch');
require('dotenv').config({ path: './.env' });

const FIGMA_TOKEN = process.env.FIGMA_TOKEN;
const FILE_KEY = process.env.FIGMA_FILE_KEY;

async function fetchFigmaFile() {
  const res = await fetch(`https://api.figma.com/v1/files/${FILE_KEY}`, {
    headers: { 'X-Figma-Token': FIGMA_TOKEN },
  });

  if (!res.ok) throw new Error(`Figma API Error: ${res.statusText}`);
  const data = await res.json();

  fs.mkdirSync('../figma', { recursive: true });
  fs.writeFileSync('../figma/design.json', JSON.stringify(data, null, 2));
  console.log('✅ Figma-Design aktualisiert.');
}

fetchFigmaFile().catch(err => {
  console.error('❌ Fehler beim Abrufen der Figma-Datei:', err.message);
});
