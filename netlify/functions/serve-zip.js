const fs = require('fs');
const path = require('path');

exports.handler = async (event) => {
  const { pathParameters } = event;
  const zipFilename = pathParameters?.splat;

  if (!zipFilename) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing filename' }),
      headers: { 'Access-Control-Allow-Origin': '*' }
    };
  }

  // Path to persistent storage
  const zipPath = path.join(process.cwd(), 'public', 'zips', zipFilename);

  try {
    if (!fs.existsSync(zipPath)) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'ZIP file not found' }),
        headers: { 'Access-Control-Allow-Origin': '*' }
      };
    }

    const file = fs.readFileSync(zipPath);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename=${zipFilename}`,
        'Access-Control-Allow-Origin': '*'
      },
      body: file.toString('base64'),
      isBase64Encoded: true
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Server error',
        details: error.message 
      }),
      headers: { 'Access-Control-Allow-Origin': '*' }
    };
  }
};
