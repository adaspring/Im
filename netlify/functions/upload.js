const multiparty = require('multiparty');
const fs = require('fs');
const path = require('path');

// Persistent storage directory (Git LFS tracked)
const STORAGE_DIR = path.join(process.cwd(), 'public', 'uploads');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
      headers: { 'Access-Control-Allow-Origin': '*' }
    };
  }

  return new Promise((resolve) => {
    const form = new multiparty.Form();
    const uploadedFiles = [];

    form.parse(event, async (err, fields, files) => {
      if (err) {
        return resolve({
          statusCode: 400,
          body: JSON.stringify({ error: 'Form parsing failed' }),
          headers: { 'Access-Control-Allow-Origin': '*' }
        });
      }

      try {
        // Ensure storage directory exists
        if (!fs.existsSync(STORAGE_DIR)) {
          fs.mkdirSync(STORAGE_DIR, { recursive: true });
        }

        // Process each file
        for (const file of files.images || []) {
          const originalExt = path.extname(file.originalFilename);
          const newFilename = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}${originalExt}`;
          const targetPath = path.join(STORAGE_DIR, newFilename);
          
          fs.renameSync(file.path, targetPath);
          uploadedFiles.push({
            originalName: file.originalFilename,
            storedName: newFilename,
            url: `/uploads/${newFilename}` // Publicly accessible URL
          });
        }

        resolve({
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            uploaded: uploadedFiles,
            message: `${uploadedFiles.length} file(s) stored permanently`
          }),
          headers: { 'Access-Control-Allow-Origin': '*' }
        });
      } catch (error) {
        resolve({
          statusCode: 500,
          body: JSON.stringify({ 
            error: 'Upload processing failed',
            details: error.message 
          }),
          headers: { 'Access-Control-Allow-Origin': '*' }
        });
      }
    });
  });
};
