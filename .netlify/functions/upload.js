const formidable = require('formidable');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const mkdir = promisify(fs.mkdir);
const { exec } = require('child_process');
const execPromise = promisify(exec);

// Base directory for uploaded images
const BASE_DIR = path.join(__dirname, '..', '..', 'tmp');
const UPLOADS_DIR = path.join(BASE_DIR, 'uploaded_images');
const OUTPUT_DIR = path.join(BASE_DIR, 'output_zips');

// Helper function to ensure directories exist
const ensureDirectoryExistence = async (dirPath) => {
  try {
    await mkdir(dirPath, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
};

exports.handler = async (event, context) => {
  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, message: 'Method not allowed' })
    };
  }

  try {
    // Ensure upload directories exist
    await ensureDirectoryExistence(UPLOADS_DIR);
    await ensureDirectoryExistence(OUTPUT_DIR);

    // Parse the incoming form data
    const form = new formidable.IncomingForm({
      uploadDir: UPLOADS_DIR,
      keepExtensions: true,
      maxFileSize: 50 * 1024 * 1024, // 50MB limit
      multiples: true
    });

    // Process the uploaded files
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(event, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    // Convert files to array if it's not already
    const uploadedFiles = files.images ? 
      (Array.isArray(files.images) ? files.images : [files.images]) : 
      [];

    if (uploadedFiles.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          success: false, 
          message: 'No files were uploaded' 
        })
      };
    }

    // Ensure all files are images and move them to upload directory
    for (const file of uploadedFiles) {
      // Check if the file is an image
      if (!file.mimetype || !file.mimetype.startsWith('image/')) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            message: `File ${file.originalFilename || 'unknown'} is not an image`
          })
        };
      }

      // Make sure file is properly saved with original filename
      const newPath = path.join(UPLOADS_DIR, file.originalFilename || path.basename(file.filepath));
      
      // Rename the file if it's not already in the right place with the right name
      if (file.filepath !== newPath) {
        fs.renameSync(file.filepath, newPath);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        uploaded: uploadedFiles.length,
        message: `Successfully uploaded ${uploadedFiles.length} image(s)`
      })
    };
  } catch (error) {
    console.error('Upload error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: `Server error: ${error.message}`
      })
    };
  }
};
