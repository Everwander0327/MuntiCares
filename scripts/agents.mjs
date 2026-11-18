// Usage: node scripts/agents.mjs <audit|implement> <backend|frontend>
import { spawnSync } from "node:child_process";
import { writeFileSync, readFileSync, mkdirSync, existsSync, appendFileSync, statSync } from "node:fs";

const [stage, area] = process.argv.slice(2);
if (!["audit", "implement"].includes(stage) || !["backend", "frontend"].includes(area)) {
  console.log("Usage: node scripts/agents.mjs <audit|implement> <backend|frontend>");
  process.exit(1);
}

const dir = `docs/${area}`;
mkdirSync(dir, { recursive: true });

if (stage === "implement") {
  if (!existsSync(`${dir}/decisions.md`)) {
    console.log(`Wala pang ${dir}/decisions.md. Mag-audit muna at gawin ang desisyon mo.`);
    process.exit(1);
  }
  const d = readFileSync(`${dir}/decisions.md`, "utf8");
  if (/^\s*[FNU]\d+:\s*\?\s*$/m.test(d)) {
    console.log(`May "?" pa sa ${dir}/decisions.md. Palitan mo muna ng A/B/C/skip.`);
    process.exit(1);
  }
}

const promptFile = `agents/prompts/${area}-${stage}.md`;
if (!existsSync(promptFile)) {
  console.log(`Wala ang ${promptFile}`);
  process.exit(1);
}
const prompt = `"Follow the instructions in ${promptFile}"`;
const outFile = stage === "audit" ? `${dir}/findings.md` : `${dir}/implementation-log.md`;

// Flags verified against: codex-cli 0.169.0, gemini 0.66.0
const [tool, args] =
  area === "backend"
    ? ["codex", ["exec", "--sandbox", stage === "audit" ? "read-only" : "workspace-write", "-o", outFile, prompt]]
    : ["gemini", ["--skip-trust", "--approval-mode", stage === "audit" ? "plan" : "auto_edit", "-p", prompt]];

console.log(`\n>> Running ${tool} (${area} ${stage})... maghintay ka lang, pwedeng abutin ng ilang minuto.\n`);
const r = spawnSync(tool, args, { encoding: "utf8", shell: true, maxBuffer: 100 * 1024 * 1024 });

if (r.status !== 0) {
  console.log(`May error:\n${r.stderr || r.stdout}`);
  process.exit(1);
}

// Codex writes outFile via -o. Gemini (or empty file) -> use stdout.
const hasOut = existsSync(outFile) && statSync(outFile).size > 0;
if (!hasOut || tool === "gemini") writeFileSync(outFile, r.stdout || "");
console.log(`Done. Basahin: ${outFile}`);

if (stage === "audit") {
  const text = readFileSync(outFile, "utf8");
  const ids = [...new Set([...text.matchAll(/^#{2,4}\s*([FNU]\d+)\b/gm)].map((m) => m[1]))];
  const tpl = `${dir}/decisions.md`;
  if (!existsSync(tpl)) {
    writeFileSync(
      tpl,
      `# Decisions (${area})\n# Palitan ang "?" ng A / B / C / skip. Pwede kang magdagdag ng note sa dulo.\n\n` +
        ids.map((id) => `${id}: ?`).join("\n") + "\n"
    );
    console.log(`Ginawa ko ang ${tpl} na may ${ids.length} items. I-edit mo na.`);
  } else {
    console.log(`May ${tpl} na, hindi ko ginalaw.`);
  }
  console.log(`Next: basahin ang findings, i-edit ang decisions.md, tapos run: npm run impl:${area === "backend" ? "be" : "fe"}`);
} else {
  // Runner runs the checks itself (agents can't run shell commands unattended in some modes)
  console.log("\n>> Running checks (lint, build, test)...");
  let report = "\n\n## Runner checks (automatic)\n";
  for (const [name, cmd] of [["lint", "npm run lint"], ["build", "npm run build"], ["test", "npm test"]]) {
    const c = spawnSync(cmd, { encoding: "utf8", shell: true, maxBuffer: 100 * 1024 * 1024 });
    const ok = c.status === 0;
    const tail = ((c.stdout || "") + (c.stderr || "")).trim().split("\n").slice(-25).join("\n");
    console.log(`   ${name}: ${ok ? "PASS" : "FAIL"}`);
    report += `\n### ${name}: ${ok ? "PASS" : "FAIL"}\n\`\`\`\n${tail}\n\`\`\`\n`;
  }
  report += "\nNote: may mga kilalang luma nang failures (Framer Motion ref warning, Chrome-launch timeout). I-compare sa git diff kung galing ba sa changes.\n";
  appendFileSync(outFile, report);
  console.log(`\nTapos. Basahin ang ${outFile}, tapos i-review ang 'git diff'.`);
}
