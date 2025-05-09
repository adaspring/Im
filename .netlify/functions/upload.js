const AWS = require('aws-sdk');
const multiparty = require('multiparty');

// Configure AWS S3 - Netlify will provide these via environment variables
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

exports.handler = async function (event, context) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  return new Promise((resolve) => {
    const form = new multiparty.Form();
    const uploaded = [];

    form.parse(event, async (err, fields, files) => {
      if (err) {
        return resolve({
          statusCode: 400,
          body: JSON.stringify({ error: 'Form parsing failed', details: err.message })
        });
      }

      const images = files.images || [];

      try {
        // Process all uploaded images
        for (const file of images) {
          const fileContent = require('fs').readFileSync(file.path);
          const params = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: `uploads/${file.originalFilename}`,
            Body: fileContent,
            ACL: 'public-read', // Set appropriate permissions
            ContentType: file.headers['content-type']
          };

          // Upload to S3
          const data = await s3.upload(params).promise();
          uploaded.push({
            filename: file.originalFilename,
            url: data.Location
          });
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
