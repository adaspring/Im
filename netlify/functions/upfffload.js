const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const multiparty = require('multiparty');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploaded_images');
const PARAMS_FILE = path.join(__dirname, '..', '..', 'selected_params.json');
const PYTHON_SCRIPT = path.join(__dirname, '..', '..', 'sort_and_zip.py');

exports.handler = async function (event, context) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  return new Promise((resolve) => {
    const form = new multiparty.Form();
    const uploaded = [];
    let selectedParams = [];

    // Parse multipart form (images + selected categories)
    form.parse(event, async (err, fields, files) => {
      if (err) {
        return resolve({
          statusCode: 400,
          body: JSON.stringify({ error: 'Form parsing failed', details: err.message })
        });
      }

      // Ensure upload directory exists
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });

      // Save uploaded files
      if (files && files.images) {
        for (const file of files.images) {
          const destPath = path.join(UPLOAD_DIR, file.originalFilename);
          fs.copyFileSync(file.path, destPath);
          uploaded.push(file.originalFilename);
        }
      }

      // Save selected categories (if present)
      if (fields && fields.selected) {
        try {
          selectedParams = JSON.parse(fields.selected[0]);
          fs.writeFileSync(PARAMS_FILE, JSON.stringify(selectedParams));
        } catch (e) {
          return resolve({
            statusCode: 400,
            body: JSON.stringify({ error: 'Invalid category data', details: e.message })
          });
        }
      }

      // Call Python script to classify and zip
      const py = spawn('python3', [PYTHON_SCRIPT]);
      let output = '';

      py.stdout.on('data', (data) => {
        output += data.toString();
      });

      py.stderr.on('data', (data) => {
        console.error('stderr:', data.toString());
      });

      py.on('close', (code) => {
        const result = {
          success: code === 0,
          uploaded,
          sorted: selectedParams,
          output
        };
        resolve({
          statusCode: 200,
          body: JSON.stringify(result)
        });
      });
    });
  });
};
