const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'client', 'src');

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (stat.isFile() && (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts'))) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      let modified = false;

      // Fix double backgrounds on modals
      if (content.includes('bg-black bg-surface') || content.includes('bg-gray-500 bg-opacity-75')) {
        content = content.replace(/bg-black bg-surface/g, 'bg-black/40 backdrop-blur-sm');
        content = content.replace(/bg-gray-500 bg-opacity-75/g, 'bg-black/40 backdrop-blur-sm');
        modified = true;
      }

      // AppLayout styling polish
      if (fullPath.endsWith('AppLayout.tsx')) {
        content = content.replace('bg-surface border-b', 'bg-surface border-b border-strong');
        modified = true;
      }

      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated overlay in ${fullPath}`);
      }
    }
  }
}

processDirectory(directoryPath);
