const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const multiparty = require('multiparty');

// Permanent directory for uploaded images
const STORAGE_DIR = path.join(__dirname, '..', '..', 'zips', 'uploaded_images');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  return new Promise((resolve) => {
    const form = new multiparty.Form();

    form.parse(event, async (err, fields, files) => {
      if (err) {
        return resolve({
          statusCode: 400,
          body: JSON.stringify({ error: 'Form parsing failed', details: err.message })
        });
      }

      const uploaded = [];
      const images = files.images || [];

      try {
        // Ensure the storage directory exists
        fs.mkdirSync(STORAGE_DIR, { recursive: true });

        // Save all image files
        for (const file of images) {
          const buffer = fs.readFileSync(file.path);
          const targetPath = path.join(STORAGE_DIR, file.originalFilename);
          fs.writeFileSync(targetPath, buffer);
          uploaded.push(file.originalFilename);
        }

        resolve({
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            message: 'Images uploaded successfully',
            uploaded
          })
        });
      } catch (error) {
        console.error('Upload failed:', error);
        resolve({
          statusCode: 500,
          body: JSON.stringify({ error: 'Upload failed', details: error.message })
        });
      }
    });
  });
};
