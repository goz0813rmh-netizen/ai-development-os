import fs from "node:fs/promises";

const required = ["OPENAI_API_KEY", "GITHUB_TOKEN", "GITHUB_REPOSITORY", "ISSUE_NUMBER"];
for (const key of required) {
  if (!process.env[key]) throw new Error(`${key} is required`);
}

const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
const issueNumber = Number(process.env.ISSUE_NUMBER);
const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

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

async function runAgent(name, instructions, task, previousOutputs) {
  const input = [
    `あなたはAI Company OSの${name}です。`,
    "以下の役割定義に厳密に従ってください。",
    instructions,
    "",
    "# 今回のIssue",
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
      max_output_tokens: 900,
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

const task = `タイトル: ${issue.title}\n\n本文:\n${issue.body || "（本文なし）"}`;
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
  const text = await runAgent(name, instructions, task, previous);
  outputs.push({ name, text });
  console.log(`Completed: ${name}`);
}

const body = [
  "# AI Company OS v0.1",
  `Issue #${issueNumber}を4人のAgentで処理しました。`,
  ...outputs.map((x) => `## ${x.name}\n${x.text}`),
  "---",
  `Model: \`${model}\``,
  "CEOは内容を承認・修正し、次のIssueへ進めてください。",
].join("\n\n");

await github(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ body }),
});

console.log(`Posted company output to Issue #${issueNumber}`);
