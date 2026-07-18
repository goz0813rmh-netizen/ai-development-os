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
    "CEO未承認の仮説は確定事項として扱わず、その仮説に依存する判断は明示してください。",
    "AI組織を作り続けることを目的化せず、現在のフェーズの完成と投資判断を育てる本来の事業を優先してください。",
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

const plannerInstructions = await fs.readFile("docs/agents/PLANNER.md", "utf8");
const plannerTask = [
  "# 原文",
  originalIssue,
  "",
  "# Issue Brief",
  issueBrief,
  "",
  "Assumptions（CEO未承認）は検討用の仮置きです。確定事項として扱わず、依存する計画にはその旨を明記してください。",
].join("\n");
const plan = await runAgent(
  "Planner",
  plannerInstructions,
  companyContext,
  plannerTask,
  `## Issue Analyzer\n${issueBrief}`,
);
console.log("Completed: Planner");

const architectInstructions = await fs.readFile("docs/agents/ARCHITECT.md", "utf8");
const architectTask = [
  plannerTask,
  "",
  "# Planner",
  plan,
  "",
  "Plannerの最優先項目を実現する最小の変更方針を設計してください。Plannerが今はやらないとした項目は対象外です。",
].join("\n");
const architecture = await runAgent(
  "Architect",
  architectInstructions,
  companyContext,
  architectTask,
  [`## Issue Analyzer\n${issueBrief}`, `## Planner\n${plan}`].join("\n\n"),
);
console.log("Completed: Architect");

const sharedTask = [
  "# 原文",
  originalIssue,
  "",
  "# Issue Brief",
  issueBrief,
  "",
  "# Planner",
  plan,
  "",
  "# Architect",
  architecture,
  "",
  "後続AgentはIssue Briefを共通認識、Plannerを実行方針、Architectを変更方針として扱い、原文との矛盾がある場合は原文を優先してください。",
  "Assumptions（CEO未承認）は検討用の仮置きです。確定事項として扱わず、依存する提案にはその旨を明記してください。",
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
  const previous = [
    `## Issue Analyzer\n${issueBrief}`,
    `## Planner\n${plan}`,
    `## Architect\n${architecture}`,
    ...outputs.map((x) => `## ${x.name}\n${x.text}`),
  ].join("\n\n");
  const text = await runAgent(name, instructions, companyContext, sharedTask, previous);
  outputs.push({ name, text });
  console.log(`Completed: ${name}`);
}

const body = [
  "# AI Company OS v0.4",
  `Issue #${issueNumber}をIssue Analyzer、Planner、Architect、4人のAgentで処理しました。`,
  "会社資料、Issue Brief、実行優先順位、変更方針を共通コンテキストとして参照しています。",
  `## Issue Brief\n${issueBrief}`,
  "> ⚠️ **CEOレビュー対象**: `Assumptions（CEO未承認）`はAIによる仮置きです。承認されるまでは確定事項ではありません。",
  `## Planner\n${plan}`,
  `## Architect\n${architecture}`,
  ...outputs.map((x) => `## ${x.name}\n${x.text}`),
  "---",
  "## CEOに確認してほしいこと",
  "1. `Assumptions（CEO未承認）`は正しいか",
  "2. Plannerの優先順位と対象外は妥当か",
  "3. Architectの変更方針で実装へ進めてよいか",
  "",
  "回答例: `仮説はOK。優先順位・設計ともにGO`",
  `Model: \`${model}\``,
].join("\n\n");

await github(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ body }),
});

console.log(`Posted company output to Issue #${issueNumber}`);