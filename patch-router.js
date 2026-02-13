const fs = require('fs');
const p = 'src/router/config.tsx';
let s = fs.readFileSync(p, 'utf8');
const block = "// const NotFound = lazy(() => import('../pages/NotFound'));\nconst NotFound = () => (\n  <div className=\"min-h-screen bg-dark-bg flex items-center justify-center p-4\">\n    <div className=\"text-center\">\n      <h1 className=\"text-4xl font-black text-white mb-4\">404</h1>\n      <p className=\"text-neutral-500\">Page not found</p>\n    </div>\n  </div>\n);";
const replacement = "const NotFound = lazy(() => import('../pages/NotFound'));";
if (s.includes(block)) s = s.replace(block, replacement);
else s = s.replace(/\/\/ const NotFound[\s\S]*?\);\n\);/m, replacement);
fs.writeFileSync(p, s);
