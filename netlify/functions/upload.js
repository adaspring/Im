const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  const boundary = event.headers['content-type'].split('boundary=')[1];
  const bodyBuffer = Buffer.from(event.body, 'base64');
  const bodyText = bodyBuffer.toString('utf8');

  const uploadsDir = path.join(__dirname, '../../uploaded_images');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const matches = bodyText.matchAll(/name="file"; filename="(.+?)"\r\nContent-Type: (.+?)\r\n\r\n([\s\S]*?)\r\n--/g);
  let uploadedFiles = [];

  for (const match of matches) {
    const filename = match[1];
    const fileContent = match[3];
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, fileContent, 'utf8');
    uploadedFiles.push(filename);
  }

  const tagsMatch = bodyText.match(/name="tags"\r\n\r\n(.+?)\r\n--/);
  if (tagsMatch) {
    const selectedTags = tagsMatch[1].split(',').map(t => t.trim());
    const jsonPath = path.join(__dirname, '../../selected_params.json');
    fs.writeFileSync(jsonPath, JSON.stringify(selectedTags, null, 2));

    // Run the Python script directly on Netlify
    const result = spawnSync('python3', ['sort_and_zip.py'], {
      cwd: path.join(__dirname, '../../'),
      encoding: 'utf-8'
    });

    if (result.error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to run classification', detail: result.error.message })
      };
    }

    if (result.stderr) {
      console.error("STDERR:", result.stderr);
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, uploaded: uploadedFiles.length, sorted: !!tagsMatch }),
  };
};
