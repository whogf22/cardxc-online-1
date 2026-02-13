import fs from "fs";
import { exec } from "child_process";
import fetch from "node-fetch";

const RUN_CMD = "npm start";

function run() {
  console.log("🚀 Running project...");
  exec(RUN_CMD, async (err, stdout, stderr) => {
    if (!err) {
      console.log("✅ NO ERROR. PROJECT FIXED.");
      return;
    }
    console.log("❌ ERROR FOUND → Sending to AI...");
    await askAI(stderr);
  });
}

async function askAI(errorLog) {
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: `
You are a senior developer.
Fix the error.
Respond ONLY in JSON like:
{
  "file": "file name",
  "code": "FULL fixed file code"
}
`
        },
        { role: "user", content: errorLog }
      ]
    })
  });

  const data = await res.json();
  applyFix(data.choices[0].message.content);
}

function applyFix(aiText) {
  try {
    const fix = JSON.parse(aiText);
    fs.writeFileSync(fix.file, fix.code, "utf8");
    console.log("🔧 FIX APPLIED:", fix.file);
    run();
  } catch {
    console.log("⚠️ AI response invalid, manual check needed");
  }
}

run();
