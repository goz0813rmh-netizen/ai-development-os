import fs from "node:fs/promises";

const required = ["OPENAI_API_KEY", "GITHUB_TOKEN", "GITHUB_REPOSITORY", "ISSUE_NUMBER"];
for (const key of required) {
  if (!process.env[key]) throw new Error(`${key} is required`);
}

const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
const issueNumber = Number(process.env.ISSUE_NUMBER);
const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

const contextFiles = [
  "README.md",
  "docs/COMPANY.md",
  "docs/CONSTITUTION.md",
  "docs/ORGANIZATION.md",
  "docs/WORKFLOW.md",
  "docs/BACKLOG.md",
  "docs/DECISIONS.md",
];

async function github(path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
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

async function loadCompanyContext() {
  const sections = [];

  for (const path of contextFiles) {
    try {
      const content = await fs.readFile(path, "utf8");
      sections.push(`## ${path}\n${content.trim()}`);
    } catch (error) {
      if (error?.code === "ENOENT") {
        console.warn(`Context file not found: ${path}`);
        continue;
      }
      throw error;
    }
  }

  if (sections.length === 0) return "会社コンテキストなし";
  return sections.join("\n\n");
}

async function runAgent(name, instructions, companyContext, task, previousOutputs) {
  const input = [
    `あなたはAI Company OSの${name}です。`,
    "以下の役割定義と会社コンテキストに厳密に従ってください。",
    "一般論ではなく、この会社・プロダクト・Issueに固有の判断をしてください。",
    "事実と推測を分け、不足情報があっても合理的な仮置きを明示して前進してください。",
    "",
    "# 役割定義",
    instructions,
    "",
    "# 会社コンテキスト",
    companyContext,
    "",
    "# 今回の入力",
    task,
    "",
    "# 先行Agentの出力",
    previousOutputs || "なし",
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input,
      max_output_tokens: 1200,
    }),
  });

  if (!response.ok) throw new Error(`OpenAI API ${response.status}: ${await response.text()}`);
  const data = await response.json();
  const text = data.output_text || data.output
    ?.flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text")
    .map((item) => item.text)
    .join("\n");
  if (!text) throw new Error(`${name} returned no text`);
  return text.trim();
}

const issue = await github(`/repos/${owner}/${repo}/issues/${issueNumber}`);
if (issue.pull_request) throw new Error("Pull requests are not supported. Run this on an Issue.");

const companyContext = await loadCompanyContext();
console.log(`Loaded ${contextFiles.length} company context files`);

const originalIssue = `タイトル: ${issue.title}\n\n本文:\n${issue.body || "（本文なし）"}`;
const analyzerInstructions = await fs.readFile("docs/agents/ISSUE_ANALYZER.md", "utf8");
const issueBrief = await runAgent(
  "Issue Analyzer",
  analyzerInstructions,
  companyContext,
  originalIssue,
  "なし",
);
console.log("Completed: Issue Analyzer");

const sharedTask = [
  "# 原文",
  originalIssue,
  "",
  "# Issue Brief",
  issueBrief,
  "",
  "後続AgentはIssue Briefを共通認識として扱い、原文との矛盾がある場合は原文を優先してください。",
].join("\n");

const roles = [
  ["Facilitator", "docs/agents/FACILITATOR.md"],
  ["CPO", "docs/agents/CPO.md"],
  ["Auditor", "docs/agents/AUDITOR.md"],
  ["Historian", "docs/agents/HISTORIAN.md"],
];

const outputs = [];
for (const [name, path] of roles) {
  const instructions = await fs.readFile(path, "utf8");
  const previous = outputs.map((x) => `## ${x.name}\n${x.text}`).join("\n\n");
  const text = await runAgent(name, instructions, companyContext, sharedTask, previous);
  outputs.push({ name, text });
  console.log(`Completed: ${name}`);
}

const body = [
  "# AI Company OS v0.3",
  `Issue #${issueNumber}をIssue Analyzerと4人のAgentで処理しました。`,
  "会社資料と構造化したIssue Briefを共通コンテキストとして参照しています。",
  `## Issue Brief\n${issueBrief}`,
  ...outputs.map((x) => `## ${x.name}\n${x.text}`),
  "---",
  `Model: \`${model}\``,
  "CEOはIssue Briefが意図に合っているかを確認し、承認・修正してください。",
].join("\n\n");

await github(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ body }),
});

console.log(`Posted company output to Issue #${issueNumber}`);
