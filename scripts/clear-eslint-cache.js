const fs = require('fs');
const path = require('path');

const cacheFile = path.join(__dirname, '..', 'node_modules', '.cache', '.eslintcache');

try {
  if (fs.existsSync(cacheFile)) {
    fs.unlinkSync(cacheFile);
  }
} catch (error) {
  console.warn(`Could not remove ESLint cache: ${error.message}`);
}
