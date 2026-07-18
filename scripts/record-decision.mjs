const required = [
  "GITHUB_TOKEN",
  "GITHUB_REPOSITORY",
  "ISSUE_NUMBER",
  "CEO_COMMENT",
];

for (const key of required) {
  if (!process.env[key]) throw new Error(`${key} is required`);
}

const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
const issueNumber = Number(process.env.ISSUE_NUMBER);
const approval = process.env.CEO_COMMENT.trim();
const marker = `<!-- ai-company-os-decision:issue-${issueNumber} -->`;

if (!/^APPROVED(?:\s|\||:|$)/i.test(approval)) {
  console.log("Comment is not an APPROVED decision. Nothing to record.");
  process.exit(0);
}

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

async function listIssueComments() {
  const comments = [];
  for (let page = 1; ; page += 1) {
    const batch = await github(`/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100&page=${page}`);
    comments.push(...batch);
    if (batch.length < 100) return comments;
  }
}

async function getFile(path) {
  const file = await github(`/repos/${owner}/${repo}/contents/${path}`);
  return {
    sha: file.sha,
    content: Buffer.from(file.content, "base64").toString("utf8"),
  };
}

async function updateFile(path, previous, content, message) {
  return github(`/repos/${owner}/${repo}/contents/${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: Buffer.from(content, "utf8").toString("base64"),
      sha: previous.sha,
    }),
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractSection(body, heading) {
  const escaped = escapeRegExp(heading);
  const match = body.match(new RegExp(`(?:^|\\n)## ${escaped}\\s*\\n([\\s\\S]*?)(?=\\n## |\\n---|$)`, "i"));
  return match?.[1]?.trim() || "";
}

function extractField(body, label) {
  const escaped = escapeRegExp(label);
  return body.match(new RegExp(`^${escaped}\\s*[:：]\\s*(.+)$`, "mi"))?.[1]?.trim() || "なし";
}

const issue = await github(`/repos/${owner}/${repo}/issues/${issueNumber}`);
if (issue.pull_request) throw new Error("Pull requests are not supported.");

const comments = await listIssueComments();
const companyOutput = [...comments].reverse().find((comment) =>
  comment.body?.includes("# AI Company OS") && comment.body?.includes("## Historian")
);

if (!companyOutput) {
  throw new Error("Historianを含むAI Company OSの出力が見つかりません。先に /company を実行してください。");
}

const historian = extractSection(companyOutput.body, "Historian");
if (!historian) throw new Error("Historianの記録候補を抽出できませんでした。");

const decisions = await getFile("docs/DECISIONS.md");
if (decisions.content.includes(marker)) {
  await github(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      body: `✅ Issue #${issueNumber} の意思決定はすでに正式記録されています。重複更新は行いませんでした。`,
    }),
  });
  console.log("Decision already recorded.");
  process.exit(0);
}

const reason = extractField(approval, "理由");
const approvedAssumptions = extractField(approval, "承認した仮説");
const date = new Date().toISOString().slice(0, 10);
const issueUrl = `https://github.com/${owner}/${repo}/issues/${issueNumber}`;
const decisionEntry = [
  "",
  marker,
  `## ${date} — Issue #${issueNumber}: ${issue.title}`,
  "",
  "**Status:** Accepted",
  "",
  `**Source:** ${issueUrl}`,
  "",
  `**CEO理由:** ${reason}`,
  "",
  `**承認した仮説:** ${approvedAssumptions}`,
  "",
  "### Historian Record",
  "",
  historian,
  "",
].join("\n");

await updateFile(
  "docs/DECISIONS.md",
  decisions,
  `${decisions.content.trimEnd()}\n${decisionEntry}`,
  `docs: record approved decision for issue #${issueNumber}`,
);

let backlogUpdated = false;
const nextAction = extractField(historian, "次のアクション");
if (nextAction && nextAction !== "なし" && !/^未定$/i.test(nextAction)) {
  const backlog = await getFile("docs/BACKLOG.md");
  if (!backlog.content.includes(marker)) {
    const backlogEntry = [
      "",
      "## CEO Approved Next Actions",
      "",
      marker,
      `- [ ] Issue #${issueNumber}: ${nextAction}`,
      "",
    ].join("\n");
    await updateFile(
      "docs/BACKLOG.md",
      backlog,
      `${backlog.content.trimEnd()}\n${backlogEntry}`,
      `docs: add approved next action for issue #${issueNumber}`,
    );
    backlogUpdated = true;
  }
}

const resultLines = [
  "✅ CEOのAPPROVED判断を正式記録しました。",
  "- 更新: `docs/DECISIONS.md`",
  backlogUpdated ? "- 更新: `docs/BACKLOG.md`" : "- Backlog更新: 対象なし",
  `- 重複防止ID: \`issue-${issueNumber}\``,
];

await github(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ body: resultLines.join("\n") }),
});

console.log(`Recorded approved decision for Issue #${issueNumber}`);
