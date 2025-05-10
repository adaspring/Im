const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const axios = require('axios');

// Persistent directories
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'zips');

// Category definitions
const CATEGORIES = {
  "1": "Natural Landscape",
  "2.1": "One Person",
  // ... (keep your existing categories)
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      body: 'Method Not Allowed',
      headers: { 'Access-Control-Allow-Origin': '*' }
    };
  }

  try {
    const { categories } = JSON.parse(event.body);
    const files = fs.readdirSync(UPLOADS_DIR).filter(file => 
      ['.jpg', '.jpeg', '.png'].includes(path.extname(file).toLowerCase())
    );

    if (files.length === 0) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'No images found in storage' }),
        headers: { 'Access-Control-Allow-Origin': '*' }
      };
    }

    // Classify images (your existing AI logic)
    const categorized = await classifyImages(files, categories);
    
    // Create persistent ZIPs
    const zipFiles = await createPersistentZips(categorized);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        zipFiles: zipFiles
      }),
      headers: { 'Access-Control-Allow-Origin': '*' }
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Processing failed',
        details: error.message 
      }),
      headers: { 'Access-Control-Allow-Origin': '*' }
    };
  }
};

async function createPersistentZips(categorized) {
  const results = [];
  
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  for (const [category, files] of Object.entries(categorized)) {
    if (files.length === 0) continue;
    
    const zip = new AdmZip();
    const categoryName = CATEGORIES[category] || `Category_${category}`;
    const zipName = `sorted_${categoryName.replace(/\s+/g, '_')}.zip`;
    const zipPath = path.join(OUTPUT_DIR, zipName);

    // Add files to ZIP
    files.forEach(file => {
      zip.addLocalFile(path.join(UPLOADS_DIR, file));
    });

    // Save ZIP permanently
    zip.writeZip(zipPath);
    
    results.push({
      category,
      categoryName,
      filename: zipName,
      url: `/zips/${zipName}`,
      count: files.length
    });
  }
  
  return results;
}
