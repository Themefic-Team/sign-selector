import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const imagesDir = path.join(__dirname, 'assets', 'images');

// Recursively find all image files
function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function(file) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

const allFiles = getAllFiles(imagesDir);
const imageFiles = allFiles.filter(file => /\.(jpg|jpeg|png)$/i.test(file));

if (imageFiles.length === 0) {
  console.log('No images found to compress.');
  process.exit(0);
}

console.log(`Found ${imageFiles.length} images to compress in ${imagesDir}...\n`);

imageFiles.forEach((file, index) => {
  console.log(`[${index + 1}/${imageFiles.length}] Compressing: ${path.basename(file)}`);
  
  const dir = path.dirname(file);
  const ext = path.extname(file).toLowerCase();
  
  try {
    // 1. Optimize original file
    if (ext === '.png') {
        execSync(`npx @squoosh/cli --oxipng auto -d "${dir}" "${file}"`, { stdio: 'inherit' });
    } else if (ext === '.jpg' || ext === '.jpeg') {
        execSync(`npx @squoosh/cli --mozjpeg auto -d "${dir}" "${file}"`, { stdio: 'inherit' });
    }
    
    console.log('---');
  } catch (error) {
    console.error(`Error compressing ${file}:`, error.message);
  }
});

console.log('All images compressed successfully!');
