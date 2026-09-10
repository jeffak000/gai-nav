// 通过 GitHub Contents API 逐个文件提交（绕过 git，仅用 HTTPS/curl 可用通道）
// 用法: GH_TOKEN=xxx node push_api.js
const fs = require("fs");
const path = require("path");

const TOKEN = process.env.GH_TOKEN;
const OWNER = "jeffak000";
const REPO = "gai-nav";
const BRANCH = "main";
const ROOT = "D:/ai/EdgeOneWeb";
const SKIP = new Set([".git"]);

function walk(dir, base = "") {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    const rel = base ? base + "/" + e.name : e.name;
    if (e.isDirectory()) out.push(...walk(p, rel));
    else out.push(rel);
  }
  return out;
}
const enc = (p) => p.split("/").map((s) => encodeURIComponent(s)).join("/");

(async () => {
  if (!TOKEN) { console.log("缺少 GH_TOKEN"); process.exit(1); }
  const files = walk(ROOT);
  console.log("待提交文件数:", files.length);
  for (const f of files) {
    const content = fs.readFileSync(path.join(ROOT, f));
    const b64 = content.toString("base64");
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${enc(f)}`;
    let sha;
    try {
      const g = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json" } });
      if (g.status === 200) { const j = await g.json(); sha = j.sha; }
    } catch (e) { /* 新文件 */ }
    const body = { message: `chore: add ${f}`, content: b64, branch: BRANCH };
    if (sha) body.sha = sha;
    const r = await fetch(url, {
      method: "PUT",
      headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const t = await r.text();
    console.log(f, "->", r.status, t.slice(0, 90).replace(/\n/g, " "));
    if (!r.ok) { console.log("STOP (error above)"); process.exit(2); }
  }
  console.log("ALL_DONE");
})();
