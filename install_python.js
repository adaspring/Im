// This script installs Python requirements during Netlify build

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  console.log('Installing Python dependencies...');
  
  // Check if Python is available
  try {
    execSync('python3 --version');
    console.log('Python 3 is available');
  } catch (error) {
    console.log('Python 3 is not available, checking for Python...');
    execSync('python --version');
  }
  
  // Install requirements
  try {
    console.log('Installing Python requirements...');
    execSync('pip install -r requirements.txt', { stdio: 'inherit' });
    console.log('Python requirements installed successfully');
  } catch (error) {
    console.log('Error installing with pip, trying pip3...');
    execSync('pip3 install -r requirements.txt', { stdio: 'inherit' });
  }
  
  // Make Python script executable
  try {
    console.log('Making Python script executable...');
    fs.chmodSync('sort_and_zip.py', '755');
    console.log('Python script is now executable');
  } catch (error) {
    console.error('Error making Python script executable:', error);
  }
  
  // Create necessary directories
  const dirs = ['tmp', 'tmp/uploaded_images', 'tmp/output_zips', 'zips'];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      console.log(`Creating directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  console.log('Python setup complete!');
} catch (error) {
  console.error('Error setting up Python:', error);
  process.exit(1);
}
