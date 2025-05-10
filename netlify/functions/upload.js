const multiparty = require('multiparty');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const STORAGE_DIR = '/tmp/uploaded_images';

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  return new Promise((resolve) => {
    const form = new multiparty.Form();
    const uploaded = [];

    form.parse(event, async (err, fields, files) => {
      if (err) {
        return resolve({
          statusCode: 400,
          body: JSON.stringify({ error: 'Form parsing failed' })
        });
      }

      try {
        fs.mkdirSync(STORAGE_DIR, { recursive: true });

        for (const file of files.images || []) {
          const newFilename = `${uuidv4()}${path.extname(file.originalFilename)}`;
          const targetPath = path.join(STORAGE_DIR, newFilename);
          fs.copyFileSync(file.path, targetPath);
          uploaded.push(newFilename);
        }

        resolve({
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            uploaded: uploaded
          })
        });
      } catch (error) {
        resolve({
          statusCode: 500,
          body: JSON.stringify({ error: 'Upload failed' })
        });
      }
    });
  });
};
