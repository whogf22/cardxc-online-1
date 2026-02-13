import { spawn, execSync } from "child_process";

function safe(cmd) {
  try {
    execSync(cmd, { stdio: "ignore" });
  } catch {}
}

console.log("🧹 Cleaning busy ports...");
safe("lsof -ti:5000 | xargs kill -9 || true");
safe("lsof -ti:5173 | xargs kill -9 || true");
safe("lsof -ti:3001 | xargs kill -9 || true");

console.log("🚀 Starting backend (3001)...");
spawn("tsx", ["server/index.ts"], {
  stdio: "inherit",
  shell: true,
});

setTimeout(() => {
  console.log("🎨 Starting Vite frontend (auto port)...");
  spawn("npx", ["--yes", "vite", "--host", "0.0.0.0", "--port", "5000"], {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, NODE_ENV: "development" },
  });
}, 1500);
