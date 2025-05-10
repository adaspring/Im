const fs = require('fs');
const path = require('path');

exports.handler = async (event) => {
  const { pathParameters } = event;
  const zipFilename = pathParameters && pathParameters['splat'];
  
  if (!zipFilename) {
    return { statusCode: 400, body: 'Missing filename' };
  }

  const zipPath = path.join('/tmp/output_zips', zipFilename);

  try {
    if (!fs.existsSync(zipPath)) {
      return { statusCode: 404, body: 'ZIP file not found' };
    }

    const file = fs.readFileSync(zipPath);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename=${zipFilename}`
      },
      body: file.toString('base64'),
      isBase64Encoded: true
    };
  } catch (error) {
    return { statusCode: 500, body: error.message };
  }
};
