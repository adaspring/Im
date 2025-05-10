const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const axios = require('axios');

const UPLOADS_DIR = '/tmp/uploaded_images';
const OUTPUT_DIR = '/tmp/output_zips';

const CATEGORIES = {
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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { categories: selectedCategories } = JSON.parse(event.body);
    const files = fs.readdirSync(UPLOADS_DIR).filter(file => 
      ['.jpg', '.jpeg', '.png'].includes(path.extname(file).toLowerCase())
    );

    if (files.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No images found' }) };
    }

    const categorized = await classifyImages(files, selectedCategories);
    const zipResults = await createCategoryZips(categorized);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        zipFiles: zipResults
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

async function classifyImages(files, selectedCategories) {
  const categorized = {};
  selectedCategories.forEach(cat => { categorized[cat] = []; });

  for (const file of files) {
    try {
      const imagePath = path.join(UPLOADS_DIR, file);
      const imageBase64 = fs.readFileSync(imagePath, { encoding: 'base64' });
      
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "Classify images into these categories: " + 
                Object.entries(CATEGORIES).map(([code, name]) => `${code} - ${name}`).join(', ')
            },
            {
              role: "user",
              content: [
                { type: "text", text: `Classify this image (${file}):` },
                { type: "image_url", image_url: `data:image/jpeg;base64,${imageBase64}` }
              ]
            }
          ],
          max_tokens: 100
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const classification = response.data.choices[0].message.content;
      const matchedCategories = classification.split(',')
        .map(cat => cat.trim())
        .filter(cat => selectedCategories.includes(cat));

      matchedCategories.forEach(cat => {
        if (categorized[cat]) categorized[cat].push(file);
      });
    } catch (error) {
      console.error(`Error processing ${file}:`, error);
    }
  }

  return categorized;
}

async function createCategoryZips(categorized) {
  const results = [];
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const [categoryCode, files] of Object.entries(categorized)) {
    if (files.length === 0) continue;

    const categoryName = CATEGORIES[categoryCode];
    const zipFilename = `${categoryCode.replace('.', '_')}_${Date.now()}.zip`;
    const zipPath = path.join(OUTPUT_DIR, zipFilename);

    try {
      const zip = new AdmZip();
      files.forEach(file => zip.addLocalFile(path.join(UPLOADS_DIR, file)));
      zip.writeZip(zipPath);

      results.push({
        category: categoryCode,
        categoryName: categoryName,
        filename: zipFilename,
        url: `/.netlify/functions/serve-zip/${zipFilename}`,
        count: files.length
      });
    } catch (error) {
      console.error(`Error creating ZIP for ${categoryCode}:`, error);
    }
  }

  return results;
}
