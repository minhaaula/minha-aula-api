import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();
const sourceDir = path.resolve(projectRoot, 'docs');
const targetDir = path.resolve(projectRoot, 'dist', 'docs');

if (!fs.existsSync(sourceDir)) {
    console.warn(`Docs directory not found, skipping copy: ${sourceDir}`);
    process.exit(0);
}

function copyRecursive(src: string, dest: string) {
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
