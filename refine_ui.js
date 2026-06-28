const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'client', 'src');

const replacements = {
  'bg-white': 'bg-surface',
  'bg-gray-50': 'bg-background',
  'bg-gray-100': 'bg-elevated',
  'bg-gray-200': 'bg-elevated border-strong',
  'border-gray-100': 'border',
  'border-gray-200': 'border',
  'border-gray-300': 'border-strong',
  'text-gray-900': 'text-primary',
  'text-gray-800': 'text-primary',
  'text-gray-700': 'text-secondary',
  'text-gray-600': 'text-secondary',
  'text-gray-500': 'text-muted',
  'text-gray-400': 'text-muted',
  'bg-blue-600': 'bg-primary-accent text-white',
  'hover:bg-blue-700': 'hover:bg-primary-hover',
  'text-blue-600': 'text-primary-accent',
  'text-blue-700': 'text-primary-accent'
};

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) processDirectory(fullPath);
    else if (stat.isFile() && (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts'))) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;
      for (const [key, value] of Object.entries(replacements)) {
        // Just use word boundaries except for special chars
        const regex = new RegExp(`\\b${key}\\b`, 'g');
        if (regex.test(content)) {
          content = content.replace(regex, value);
          modified = true;
        }
      }
      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}
processDirectory(directoryPath);
