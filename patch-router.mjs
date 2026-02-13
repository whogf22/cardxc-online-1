import fs from 'fs';
const p = 'src/router/config.tsx';
let s = fs.readFileSync(p, 'utf8');
const replacement = "const NotFound = lazy(() => import('../pages/NotFound'));";
const re = /\/\/ const NotFound = lazy\(\(\) => import\([^)]+\)\);\s*\nconst NotFound = \(\) => \([\s\S]*?\n\);\s*\n\);/;
s = s.replace(re, replacement);
fs.writeFileSync(p, s);
