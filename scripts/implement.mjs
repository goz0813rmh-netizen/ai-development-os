import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
for (const key of ["OPENAI_API_KEY", "GITHUB_TOKEN", "GITHUB_REPOSITORY", "ISSUE_NUMBER"]) {
  if (!process.env[key]) throw new Error(`${key} is required`);
}

const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
const issueNumber = Number(process.env.ISSUE_NUMBER);
const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

async function github(url, options = {}) {
  const response = await fetch(`https://api.github.com${url}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

async function comments() {
  const all = [];
  for (let page = 1; ; page += 1) {
    const batch = await github(`/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100&page=${page}`);
    all.push(...batch);
    if (batch.length < 100) return all;
  }
}

async function repoContext() {
  const { stdout } = await run("git", ["ls-files"]);
  const parts = [];
  let bytes = 0;
  for (const file of stdout.split("\n").filter(Boolean)) {
    if (/\.(png|jpe?g|gif|pdf|zip|lock)$/i.test(file)) continue;
    try {
      const stat = await fs.stat(file);
      if (stat.size > 30000 || bytes + stat.size > 250000) continue;
      parts.push(`## ${file}\n${await fs.readFile(file, "utf8")}`);
      bytes += stat.size;
    } catch {}
  }
  return parts.join("\n\n");
}

function parse(text) {
  return JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
}

function safePath(value) {
  const file = path.posix.normalize(String(value).replaceAll("\\", "/"));
  if (!file || file.startsWith("../") || file.startsWith("/") || file.startsWith(".github/workflows/") || file.startsWith(".git/") || file.startsWith(".env")) {
    throw new Error(`Protected path: ${file}`);
  }
  return file;
}

async function remoteBranchSha(branch) {
  const { stdout } = await run("git", ["ls-remote", "--heads", "origin", `refs/heads/${branch}`]);
  return stdout.trim().split(/\s+/)[0] || null;
}

const issue = await github(`/repos/${owner}/${repo}/issues/${issueNumber}`);
if (issue.pull_request) throw new Error("PR is not supported");
const history = await comments();
const approval = [...history].reverse().find((x) => /^APPROVED(?:\s|\||:|$)/i.test(x.body?.trim() || ""));
const company = [...history].reverse().find((x) => x.body?.includes("# AI Company OS") && x.body?.includes("## Engineer"));
if (!approval) throw new Error("CEO APPROVED is required");
if (!company) throw new Error("Run /company before /implement");

const contract = await fs.readFile("docs/agents/IMPLEMENTER.md", "utf8");
const response = await fetch("https://api.openai.com/v1/responses", {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model,
    max_output_tokens: 10000,
    input: [
      "Return only valid JSON. For create/update return complete file contents.",
      contract,
      `# Issue\n${issue.title}\n${issue.body || ""}`,
      `# CEO Approval\n${approval.body}`,
      `# Company Output\n${company.body}`,
      `# Repository\n${await repoContext()}`,
    ].join("\n\n"),
  }),
});
if (!response.ok) throw new Error(`OpenAI API ${response.status}: ${await response.text()}`);
const data = await response.json();
const text = data.output_text || data.output?.flatMap((x) => x.content || []).filter((x) => x.type === "output_text").map((x) => x.text).join("\n");
const plan = parse(text || "");
if (!Array.isArray(plan.files) || plan.files.length < 1 || plan.files.length > 10) throw new Error("Implementer must change 1-10 files");

for (const change of plan.files) {
  change.path = safePath(change.path);
  if (!["create", "update", "delete"].includes(change.action)) throw new Error(`Invalid action: ${change.action}`);
  if (change.action !== "delete" && (typeof change.content !== "string" || Buffer.byteLength(change.content) > 100000)) throw new Error(`Invalid content: ${change.path}`);
  const exists = await fs.access(change.path).then(() => true).catch(() => false);
  if (change.action === "create" && exists) throw new Error(`Already exists: ${change.path}`);
  if (change.action !== "create" && !exists) throw new Error(`Not found: ${change.path}`);
}

const branch = `ai/issue-${issueNumber}-implementation`;
const open = await github(`/repos/${owner}/${repo}/pulls?state=open&head=${owner}:${branch}`);

await run("git", ["config", "user.name", "ai-company-os[bot]"]);
await run("git", ["config", "user.email", "ai-company-os[bot]@users.noreply.github.com"]);
await run("git", ["fetch", "origin", "main", branch]);
const previousRemoteSha = await remoteBranchSha(branch);
await run("git", ["checkout", "-B", branch, "origin/main"]);

for (const change of plan.files) {
  if (change.action === "delete") await fs.rm(change.path);
  else {
    await fs.mkdir(path.dirname(change.path), { recursive: true });
    await fs.writeFile(change.path, change.content, "utf8");
  }
}

await run("git", ["diff", "--check"]);
const { stdout: status } = await run("git", ["status", "--porcelain"]);
if (!status.trim()) throw new Error("No effective changes");
await run("git", ["add", "--all"]);
await run("git", ["commit", "-m", String(plan.commit_message || `feat: implement issue #${issueNumber}`).slice(0, 120)]);

if (previousRemoteSha) {
  await run("git", ["push", "--set-upstream", "origin", branch, `--force-with-lease=refs/heads/${branch}:${previousRemoteSha}`]);
} else {
  await run("git", ["push", "--set-upstream", "origin", branch]);
}

let pr = open[0];
let action = "更新";
if (!pr) {
  pr = await github(`/repos/${owner}/${repo}/pulls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: String(plan.pr_title || `Issue #${issueNumber}: implementation`).slice(0, 200),
      head: branch,
      base: "main",
      body: `${plan.pr_body || plan.summary || "Approved implementation"}\n\nCloses #${issueNumber}\n\n- CEO APPROVED確認済み\n- 自動マージなし\n- git diff --check実行済み`,
    }),
  });
  action = "作成";
}

await github(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    body: `✅ Implementerがレビュー用PRを${action}しました。\n- ${pr.html_url}\n- 変更ファイル数: ${plan.files.length}\n- 再実行対応: 有効\n- 自動マージ: なし`,
  }),
});