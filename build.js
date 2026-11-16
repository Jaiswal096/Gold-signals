import fs from 'fs';
import path from 'path';

const dist = path.resolve('dist');
if (!fs.existsSync(dist)) {
  fs.mkdirSync(dist, { recursive: true });
}

const files = ['index.html', 'style.css', 'app.js', 'README.md'];
for (const file of files) {
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, path.join(dist, file));
    console.log(`Copied ${file} -> dist/${file}`);
  }
}

console.log('Fast static build completed successfully.');
