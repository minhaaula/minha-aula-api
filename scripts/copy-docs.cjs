const fs = require('fs');
const path = require('path');

const sourceDir = path.resolve(__dirname, '..', 'docs');
const targetDir = path.resolve(__dirname, '..', 'dist', 'docs');

if (!fs.existsSync(sourceDir)) {
    console.warn(`Docs directory not found, skipping copy: ${sourceDir}`);
    process.exit(0);
}

function copyRecursive(src, dest) {
    const stats = fs.statSync(src);

    if (stats.isDirectory()) {
        fs.mkdirSync(dest, { recursive: true });
        for (const entry of fs.readdirSync(src)) {
            copyRecursive(path.join(src, entry), path.join(dest, entry));
        }
    } else {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
    }
}

copyRecursive(sourceDir, targetDir);
