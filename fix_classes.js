const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'client', 'src');

const replacements = {
  'text-textPrimary': 'text-primary',
  'text-textSecondary': 'text-secondary',
  'text-textMuted': 'text-muted',
  'bg-surface-elevated': 'bg-elevated',
  'text-[#131313] dark:text-[#131313] text-white dark:text-[#131313]': 'text-inverse',
  'text-[#131313]': 'text-inverse',
  'shadow-modal': 'shadow-floating',
  'shadow-surface': 'shadow-subtle',
  'border-subtle': 'border',
  'border-divider': 'border-strong',
  'hover:bg-accent-hover': 'hover:bg-primary-hover',
  'bg-accent': 'bg-primary',
  'text-accent': 'text-primary-accent',
  'ring-accent': 'ring-primary',
  'border-accent': 'border-primary',
  'text-success': 'text-status-success',
  'bg-success': 'bg-status-success',
  'border-success': 'border-status-success',
  'text-warning': 'text-status-warning',
  'bg-warning': 'bg-status-warning',
  'border-warning': 'border-status-warning',
  'text-danger': 'text-status-danger',
  'bg-danger': 'bg-status-danger',
  'border-danger': 'border-status-danger',
  'rounded-[8px]': 'rounded-xl',
  'rounded-[12px]': 'rounded-2xl',
};

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
      for (const [key, value] of Object.entries(replacements)) {
        if (content.includes(key)) {
          // simple split and join string replacement for ALL occurrences
          content = content.split(key).join(value);
          modified = true;
        }
      }
      
      // Specifically fix `bg-secondary` which should be `bg-background` in most contexts, except when it's text.
      // Actually `bg-secondary` was used previously for the app background.
      if (content.includes('bg-secondary') && fullPath !== path.join(dir, 'styles', 'index.css')) {
        content = content.split('bg-secondary').join('bg-background');
        modified = true;
      }

      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDirectory(directoryPath);
