const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { spawn } = require('child_process');

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

const BASE_DIR = path.join(__dirname, '..', '..', 'zips');
const UPLOADS_DIR = path.join(BASE_DIR, 'uploaded_images');
const OUTPUT_DIR = path.join(BASE_DIR, 'output_zips');
const PUBLIC_PATH = '/zips';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, message: 'Method not allowed' })
    };
  }

  try {
    // Parse selected categories from request
    const requestBody = JSON.parse(event.body);
    const selectedCategories = requestBody.categories || [];

    if (!selectedCategories.length) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: 'No categories selected'
        })
      };
    }

    // Ensure required directories exist
    for (const dir of [UPLOADS_DIR, OUTPUT_DIR]) {
      if (!fs.existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
    }

    // Save selected categories for use in Python
    const paramsPath = path.join(BASE_DIR, 'selected_params.json');
    await writeFile(paramsPath, JSON.stringify({ categories: selectedCategories }));

    // Run Python script with environment configured
    const env = {
      ...process.env,
      BASE_DIR,
      UPLOADS_DIR,
      OUTPUT_DIR,
      PARAMS_FILE: paramsPath
    };

    return new Promise((resolve) => {
      const pythonProcess = spawn('python3', ['sort_and_zip.py'], { env });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log('[PYTHON]', data.toString());
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        console.error('[PYTHON ERROR]', data.toString());
      });

      pythonProcess.on('close', async (code) => {
        if (code !== 0) {
          return resolve({
            statusCode: 500,
            body: JSON.stringify({
              success: false,
              message: `Python script failed: ${stderr}`
            })
          });
        }

        // Read and parse the results file
        const resultsPath = path.join(OUTPUT_DIR, 'results.json');
        let results = { success: true, zip_files: [] };

        if (fs.existsSync(resultsPath)) {
          const data = await readFile(resultsPath, 'utf8');
          results = JSON.parse(data);
        }

        // Copy zips to public folder
        const publicZipsDir = path.join(__dirname, '..', '..', 'zips');
        if (!fs.existsSync(publicZipsDir)) {
          fs.mkdirSync(publicZipsDir, { recursive: true });
        }

        const zipFiles = results.zip_files.map((zipInfo) => {
          const source = path.join(OUTPUT_DIR, zipInfo.filename);
          const dest = path.join(publicZipsDir, zipInfo.filename);
          if (fs.existsSync(source)) {
            fs.copyFileSync(source, dest);
          }

          return {
            filename: zipInfo.filename,
            url: `/zips/${zipInfo.filename}`,
            categoryName: zipInfo.name,
            category: zipInfo.category,
            count: zipInfo.image_count
          };
        });

        resolve({
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            message: `Processed ${zipFiles.length} categories`,
            zipFiles
          })
        });
      });

      pythonProcess.on('error', (err) => {
        console.error('Python spawn error:', err);
        resolve({
          statusCode: 500,
          body: JSON.stringify({ success: false, message: `Failed to run Python: ${err.message}` })
        });
      });
    });
  } catch (err) {
    console.error('Server error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: `Unexpected error: ${err.message}` })
    };
  }
};
