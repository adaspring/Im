const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const multiparty = require('multiparty');
const fetch = require('node-fetch');
const archiver = require('archiver');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TMP_DIR = '/tmp';

const CATEGORY_PROMPT = `Classify this image using only the codes:
1 - Natural landscape (no people)
2 - People present
2.1 - One person
2.2 - Two people
2.3 - More than two people
2.4 - City scene
2.5 - Natural landscape (with people)
2.6 - Food present
3.0 - Indoor scene
3.1 - Pets or animals
3.2 - Nighttime or low-light
3.3 - Group selfie or posed group
3.4 - Artistic or abstract image
3.5 - Text-heavy image
3.6 - Vehicles or transportation
3.7 - Child or baby present
3.8 - Celebration or event
Only respond with the matching category codes, comma-separated.`

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  return new Promise((resolve) => {
    const form = new multiparty.Form();
    const uploaded = [];

    form.parse(event, async (err, fields, files) => {
      if (err) {
        return resolve({ statusCode: 400, body: JSON.stringify({ error: 'Form error', details: err.message }) });
      }

      const categories = fields.selected ? JSON.parse(fields.selected[0]) : [];
      const images = files.images || [];

      const groupMap = {};

      for (const file of images) {
        const buffer = fs.readFileSync(file.path);
        const base64 = buffer.toString('base64');

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: 'You are a visual classifier.' },
              { role: 'user', content: CATEGORY_PROMPT },
              { role: 'user', content: [{ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } }] }
            ],
            max_tokens: 30
          })
        });

        const result = await response.json();
        const rawCodes = result.choices[0].message.content || '';
        const codes = rawCodes.split(',').map(c => c.trim()).filter(code => categories.includes(code));

        codes.forEach(code => {
          if (!groupMap[code]) groupMap[code] = [];
          groupMap[code].push({ filename: file.originalFilename, buffer });
        });

        uploaded.push(file.originalFilename);
      }

      const zipPaths = [];

      for (const [cat, items] of Object.entries(groupMap)) {
        const zipPath = path.join(TMP_DIR, `category_${cat.replace('.', '_')}.zip`);
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        archive.pipe(output);
        for (const item of items) {
          archive.append(Readable.from(item.buffer), { name: item.filename });
        }
        await archive.finalize();
        zipPaths.push(zipPath);
      }

      resolve({
        statusCode: 200,
        body: JSON.stringify({ success: true, uploaded, zipped: zipPaths.map(p => path.basename(p)) })
      });
    });
  });
};
