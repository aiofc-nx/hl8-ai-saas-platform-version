#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const REPORT_DIR = path.join(ROOT, "docs", "governance", "reports");
const JSON_PATH = path.join(REPORT_DIR, "milestone-report.json");
const MD_PATH = path.join(REPORT_DIR, "milestone-report.md");

function ensureReportDir() {
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }
}

function read(file) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) {
    throw new Error(`文件不存在：${file}`);
  }
  return fs.readFileSync(full, "utf8");
}

function parseTable(sectionLines) {
  const rows = sectionLines
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"))
    .filter((line) => {
      const stripped = line.replace(/\|/g, "").trim();
      return !/^[-\s]+$/.test(stripped);
    })
    .map((line) =>
      line
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim()),
    );
  if (rows.length === 0) return [];
  const headers = rows.shift() || [];
  return rows.map((cells) => {
    const result = {};
    headers.forEach((header, index) => {
      result[header] = cells[index] ?? "";
    });
    return result;
  });
}

function extractMilestones() {
  const content = read("docs/designs/iam-specification.md").split("\n");
  const start = content.findIndex((line) => line.includes("## 4. 阶段计划"));
  if (start === -1) return [];

  const tableLines = [];
  for (let i = start + 1; i < content.length; i += 1) {
    const line = content[i];
    if (line.startsWith("## ")) break;
    if (line.trim() === "") continue;
    tableLines.push(line);
  }
  return parseTable(tableLines);
}

function extractChangeLog() {
  const lines = read("docs/governance/iam-specification-change-log.md").split(
    "\n",
  );
  const tableLines = lines.filter((line) => line.startsWith("|"));
  return parseTable(tableLines).slice(-5); // latest entries
}

function extractSubdomains() {
  const lines = read("specs/001-define-iam-spec/data-model.md").split("\n");
  const start = lines.findIndex((line) => line.includes("### 子域交付清单"));
  if (start === -1) return [];

  const tableLines = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith("### ")) break;
    if (line.trim() === "") continue;
    tableLines.push(line);
  }
  return parseTable(tableLines);
}

function writeJson(payload) {
  fs.writeFileSync(JSON_PATH, JSON.stringify(payload, null, 2), "utf8");
}

function writeMarkdown(payload) {
  const lines = [
    "# IAM 里程碑与交付报告",
    "",
    `- 生成时间：${payload.generatedAt}`,
    "",
    "## 阶段计划总览",
    "",
    "| 阶段 | 目标 | 关键交付物 | 质量门槛 | 建议时长 |",
    "| ---- | ---- | ---------- | -------- | -------- |",
  ];
  payload.milestones.forEach((item) => {
    lines.push(
      `| ${item["阶段"]} | ${item["目标"]} | ${item["关键交付物"]} | ${item["质量门槛"]} | ${item["建议时长"]} |`,
    );
  });

  lines.push(
    "",
    "## 最近变更日志",
    "",
    "| 版本 | 日期 | 编写人 | 计划评审日期 | 变更摘要 | 备注 |",
    "| ---- | ---- | ------ | ------------ | -------- | ---- |",
  );
  payload.changeLog.forEach((item) => {
    lines.push(
      `| ${item["版本"]} | ${item["日期"]} | ${item["编写人"]} | ${item["计划评审日期"]} | ${item["变更摘要"]} | ${item["备注"] || ""} |`,
    );
  });

  lines.push(
    "",
    "## 子域交付清单概览",
    "",
    "| 子域 | 交付物 | 依赖 | 质量门槛 | 责任角色 | 对应阶段 |",
    "| ---- | ------ | ---- | -------- | -------- | -------- |",
  );
  payload.subdomains.forEach((item) => {
    lines.push(
      `| ${item["子域"]} | ${item["交付物"]} | ${item["依赖"]} | ${item["质量门槛"]} | ${item["责任角色"]} | ${item["对应阶段"]} |`,
    );
  });

  fs.writeFileSync(MD_PATH, lines.join("\n"), "utf8");
}

function main() {
  const args = process.argv.slice(2);
  const jsonOnly = args.includes("--json") || args.includes("--json-only");

  ensureReportDir();
  const payload = {
    generatedAt: new Date().toISOString(),
    milestones: extractMilestones(),
    changeLog: extractChangeLog(),
    subdomains: extractSubdomains(),
  };

  const issues = [];
  if (payload.milestones.length < 4) {
    issues.push("阶段计划表数据不足，至少需要 4 个阶段。");
  }
  payload.milestones.forEach((row) => {
    ["阶段", "目标", "关键交付物", "质量门槛", "建议时长"].forEach((field) => {
      if (!row[field]) {
        issues.push(`阶段计划字段缺失：${row["阶段"] ?? "未知"} - ${field}`);
      }
    });
  });
  if (payload.changeLog.length === 0) {
    issues.push("变更日志记录为空，请确认已登记。");
  }
  if (payload.subdomains.length === 0) {
    issues.push("子域交付清单为空，请检查 data-model.md。");
  }

  if (issues.length > 0) {
    issues.forEach((issue) => console.error(`[iam:milestone-report] ${issue}`));
    process.exit(1);
  }

  writeJson(payload);
  writeMarkdown(payload);

  if (jsonOnly) {
    console.log(JSON.stringify(payload, null, 2));
  }

  console.info("[iam:milestone-report] 报告生成完成。");
}

main();
