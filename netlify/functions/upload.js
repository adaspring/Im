const fs = require('fs'); const path = require('path'); const { exec } = require('child_process');

exports.handler = async (event) => { if (event.httpMethod !== 'POST') { return { statusCode: 405, body: 'Method Not Allowed' }; }

const boundary = event.headers['content-type'].split('boundary=')[1]; const body = Buffer.from(event.body, 'base64'); const parts = body.toString().split(--${boundary});

const uploadsDir = path.join(__dirname, '../../uploaded_images'); const paramPath = path.join(__dirname, '../../selected_params.json'); fs.mkdirSync(uploadsDir, { recursive: true });

let selectedParams = null; let uploadedCount = 0;

for (const part of parts) { if (part.includes('filename=')) { const match = part.match(/filename="(.+?)"/); const filename = match ? match[1] : file-${Date.now()}.jpg; const fileStart = part.indexOf('\r\n\r\n') + 4; const fileContent = part.slice(fileStart, part.lastIndexOf('\r\n')); fs.writeFileSync(path.join(uploadsDir, filename), fileContent, 'binary'); uploadedCount++; } else if (part.includes('name="selectedParams"')) { const valueStart = part.indexOf('\r\n\r\n') + 4; const valueEnd = part.lastIndexOf('\r\n'); const paramRaw = part.slice(valueStart, valueEnd).trim(); try { selectedParams = JSON.parse(paramRaw); fs.writeFileSync(paramPath, JSON.stringify(selectedParams)); } catch { return { statusCode: 400, body: 'Invalid selectedParams' }; } } }

if (selectedParams) { exec(git add uploaded_images selected_params.json && git commit -m "Trigger sort" && git push, (err, stdout, stderr) => { if (err) console.error('Git error:', stderr); }); }

return { statusCode: 200, body: JSON.stringify({ success: true, uploaded: uploadedCount, sorted: !!selectedParams }) }; };

