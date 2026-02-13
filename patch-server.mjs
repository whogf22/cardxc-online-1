import fs from 'fs';
const p = 'server/index.ts';
let s = fs.readFileSync(p, 'utf8');
if (!s.includes("pool")) s = s.replace("import { initializeDatabase } from './db/init';", "import { initializeDatabase } from './db/init';\nimport { pool } from './db/pool';");
if (!s.includes("legalRouter")) s = s.replace("import { cardCheckoutRouter", "import { legalRouter } from './routes/legal';\nimport { supportRouter } from './routes/support';\nimport { cardCheckoutRouter");
if (!s.includes("trust proxy")) s = s.replace("const app = express();", "const app = express();\n\nif (process.env.TRUST_PROXY === 'true' || process.env.REPL_ID) { app.set('trust proxy', 1); }");
if (!s.includes("return express.json")) s = s.replace("  express.json({", "  return express.json({");
if (!s.includes("/api/legal")) s = s.replace("paymentAdminRouter);\n\napp.use((req, res, next) => {\n  if (req.path.startsWith('/api/'))", "paymentAdminRouter);\napp.use('/api/legal', legalRouter);\napp.use('/api/support', supportRouter);\n\napp.use((req, res, next) => {\n  if (req.path.startsWith('/api/'))");
if (!s.includes("gracefulShutdown")) {
  s = s.replace("app.use(errorHandler);\n\nasync function startServer()", "app.use(errorHandler);\n\nlet server = null;\n\nasync function startServer()");
  s = s.replace("    app.listen(PORT, '0.0.0.0'", "    server = app.listen(PORT, '0.0.0.0'");
  s = s.replace("startServer();", "function gracefulShutdown(sig) { logger.info(sig + ' received'); if (server) { server.close(() => { void (pool && pool.end && pool.end().catch(() => {})); process.exit(0); }); setTimeout(() => process.exit(1), 10000); } else process.exit(0); }\nprocess.on('SIGTERM', () => gracefulShutdown('SIGTERM'));\nprocess.on('SIGINT', () => gracefulShutdown('SIGINT'));\nstartServer();");
}
fs.writeFileSync(p, s);
