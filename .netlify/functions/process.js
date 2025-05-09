const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { exec } = require('child_process');
const execPromise = promisify(exec);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const readdir = promisify(fs.readdir);
const mkdir = promisify(fs.mkdir);
const axios = require('axios');
const AdmZip = require('adm-zip');

// Base directories
const BASE_DIR = path.join(__dirname, '..', '..', 'tmp');
const UPLOADS_DIR = path.join(BASE_DIR, 'uploaded_images');
const OUTPUT_DIR = path.join(BASE_DIR, 'output_zips');
const PUBLIC_PATH = '/zips';

// Category names mapping
const CATEGORY_NAMES = {
  "1": "Natural Landscape (No People)",
  "2.1": "One Person",
  "2.2": "Two People",
  "2.3": "More than Two People",
  "2.4": "City Scene",
  "2.5": "Natural Landscape with People",
  "2.6": "Food Present",
  "3.0": "Indoor Scene",
  "3.1": "Pets or Animals",
  "3.2": "Nighttime or Low-light",
  "3.3": "Group Selfie or Posed Group",
  "3.4": "Artistic or Abstract Image",
  "3.5": "Text-heavy Image",
  "3.6": "Vehicles or Transportation",
  "3.7": "Child or Baby Present",
  "3.8": "Celebration or Event"
};

// Helper function to ensure directories exist
const ensureDirectoryExistence = async (dirPath) => {
  try {
    await mkdir(dirPath, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
};

// Function to encode image to base64
const imageToBase64 = async (imagePath) => {
  try {
    const imageBuffer = await readFile(imagePath);
    return imageBuffer.toString('base64');
  } catch (error) {
    console.error(`Error reading image ${imagePath}:`, error);
    return null;
  }
};

// Function to classify an image using OpenAI's GPT-4o
const classifyImage = async (base64Image, filename) => {
  try {
    const payload = {
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an image classification assistant. You'll be provided with an image, and your task is to classify it according to these categories:
          1    - Natural landscape (no people)
          2.1  - One person
          2.2  - Two people
          2.3  - More than two people
          2.4  - City scene
          2.5  - Natural landscape (with people)
          2.6  - Food present
          3.0  - Indoor scene
          3.1  - Pets or animals
          3.2  - Nighttime or low-light
          3.3  - Group selfie or posed group
          3.4  - Artistic or abstract image
          3.5  - Text-heavy image (e.g. signs, menus)
          3.6  - Vehicles or transportation
          3.7  - Child or baby present
          3.8  - Celebration or event
          
          Respond ONLY with the applicable category codes, separated by commas. For example: "1,3.2" or "2.1,3.0,3.4"
          Multiple categories can apply to a single image. Be specific and accurate.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Please classify this image (${filename}):`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 100
    };

    const response = await axios.post('https://api.openai.com/v1/chat/completions', payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      }
    });

    const classification = response.data.choices[0].message.content.trim();
    console.log(`Image ${filename} classified as: ${classification}`);
    
    // Extract category codes (which are numbers like 1, 2.1, 3.5, etc.)
    const categories = classification.split(',').map(cat => cat.trim());
    return categories;
  } catch (error) {
    console.error(`Error classifying image ${filename}:`, error);
    return [];
  }
};

// Function to create zip files for each category
const createCategoryZips = async (categorizedImages, selectedCategories) => {
  const zipFilesInfo = [];

  for (const category of selectedCategories) {
    const images = categorizedImages[category] || [];
    
    if (images.length === 0) {
      console.log(`No images for category ${category}, skipping zip creation`);
      continue;
    }

    try {
      const categoryName = CATEGORY_NAMES[category] || `Category ${category}`;
      const zipFileName = `${category.replace('.', '_')}_${categoryName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.zip`;
      const zipFilePath = path.join(OUTPUT_DIR, zipFileName);
      
      const zip = new AdmZip();
      
      for (const image of images) {
        const imagePath = path.join(UPLOADS_DIR, image);
        if (fs.existsSync(imagePath)) {
          zip.addLocalFile(imagePath);
        }
      }
      
      zip.writeZip(zipFilePath);
      
      zipFilesInfo.push({
        filename: zipFileName,
        url: `${PUBLIC_PATH}/${zipFileName}`,
        categoryName: categoryName,
        category: category,
        count: images.length
      });
      
      console.log(`Created zip file for category ${category}: ${zipFileName}`);
    } catch (error) {
      console.error(`Error creating zip for category ${category}:`, error);
    }
  }
  
  return zipFilesInfo;
};

exports.handler = async (event, context) => {
  // Only accept POST methods
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, message: 'Method not allowed' })
    };
  }

  try {
    // Make sure we have the OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          success: false, 
          message: 'OpenAI API key not configured'
        })
      };
    }

    // Parse the request body
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

    // Ensure directories exist
    await ensureDirectoryExistence(UPLOADS_DIR);
    await ensureDirectoryExistence(OUTPUT_DIR);
    
    // Create a parameters file for the Python script
    const paramsPath = path.join(BASE_DIR, 'selected_params.json');
    await writeFile(paramsPath, JSON.stringify({ categories: selectedCategories }));
    
    // Run the Python script
    console.log('Starting Python script for image processing...');
    
    return new Promise((resolve, reject) => {
      // Prepare environment variables for Python
      const env = {
        ...process.env,
        BASE_DIR,
        UPLOADS_DIR,
        OUTPUT_DIR,
        PARAMS_FILE: paramsPath
      };
      
      // Execute the Python script
      const pythonProcess = spawn('python3', ['sort_and_zip.py'], { env });
      
      let stdoutData = '';
      let stderrData = '';
      
      pythonProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
        console.log(`Python stdout: ${data}`);
      });
      
      pythonProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
        console.error(`Python stderr: ${data}`);
      });
      
      pythonProcess.on('close', async (code) => {
        console.log(`Python process exited with code ${code}`);
        
        if (code !== 0) {
          resolve({
            statusCode: 500,
            body: JSON.stringify({
              success: false,
              message: `Python script failed with code ${code}: ${stderrData}`
            })
          });
          return;
        }
        
        try {
          // Read the results from the Python script
          const resultsPath = path.join(OUTPUT_DIR, 'results.json');
          let results;
          
          if (fs.existsSync(resultsPath)) {
            const resultsData = await readFile(resultsPath, 'utf8');
            results = JSON.parse(resultsData);
          } else {
            results = { success: true, zip_files: [] };
          }
          
          // Make sure all zip files are accessible for download
          const publicZipsDir = path.join(__dirname, '..', '..', 'zips');
          await ensureDirectoryExistence(publicZipsDir);
          
          // Transform the zip files information into downloadable links
          const zipFiles = results.zip_files.map(zipInfo => {
            const sourceZip = path.join(OUTPUT_DIR, zipInfo.filename);
            const targetZip = path.join(publicZipsDir, zipInfo.filename);
            
            // Copy the zip file to the public directory
            if (fs.existsSync(sourceZip)) {
              fs.copyFileSync(sourceZip, targetZip);
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
              message: `Successfully processed images into ${zipFiles.length} categories`,
              zipFiles: zipFiles
            })
          });
        } catch (error) {
          console.error('Error reading results:', error);
          resolve({
            statusCode: 500,
            body: JSON.stringify({
              success: false,
              message: `Error processing results: ${error.message}`
            })
          });
        }
      });
      
      pythonProcess.on('error', (error) => {
        console.error('Failed to start Python process:', error);
        resolve({
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            message: `Failed to start Python process: ${error.message}`
          })
        });
      });
    });
  } catch (error) {
    console.error('Processing error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: `Server error: ${error.message}`
      })
    };
  }
};
