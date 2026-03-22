import { spawn } from "child_process";

console.log("🚀 Starting backend (3001)...");
// spawn: shell:false (default), hardcoded binary and args - no user input
spawn("tsx", ["server/index.ts"], {
  stdio: "inherit",
});

setTimeout(() => {
  console.log("🎨 Starting Vite frontend (auto port)...");
  // spawn: shell:false (default), hardcoded binary and args - no user input
  spawn("npx", ["--yes", "vite", "--host", "0.0.0.0", "--port", "5000"], {
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "development" },
  });
}, 1500);
