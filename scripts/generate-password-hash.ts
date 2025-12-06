import { randomBytes, scryptSync } from 'node:crypto';

const password = process.argv[2] || 'S3nh4*secreta';

const salt = randomBytes(16).toString('hex');
const derived = scryptSync(password, salt, 64).toString('hex');
const hash = `${salt}:${derived}`;

console.log('Password:', password);
console.log('Hash:', hash);
console.log('\nUse this hash in your seed files:');
console.log(`const PASSWORD_HASH = '${hash}';`);

