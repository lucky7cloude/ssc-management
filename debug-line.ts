import fs from 'fs';
const content = fs.readFileSync('./components/TimetableManager.tsx', 'utf8');
const lines = content.split('\n');
console.log(JSON.stringify(lines[922])); // 0-indexed, so 923 is 922
console.log(JSON.stringify(lines[923]));
