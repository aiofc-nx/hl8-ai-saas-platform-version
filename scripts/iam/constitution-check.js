#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const REPORT_DIR = path.join(ROOT, "docs", "governance", "reports");
const JSON_PATH = path.join(REPORT_DIR, "constitution-check.json");
const MD_PATH = path.join(REPORT_DIR, "constitution-check.md");

const CHECKS = [
  {
    id: "CC-001",
    description: "规范包含《合规检查与风险缓解》章节",
    file: "docs/designs/iam-specification.md",
    validate: (content) => content.includes("## 6. 合规检查与风险缓解"),
    details: "检查 `docs/designs/iam-specification.md` 是否存在对应章节。",
  },
  {
    id: "CC-002",
    description: "评审模板提供证据记录栏位",
    file: "docs/governance/iam-specification-review-template.md",
    validate: (content) =>
      content.includes("证据来源") && content.includes("记录链接"),
    details: "模板必须支持记录证据与补救行动。",
  },
  {
    id: "CC-003",
    description: "治理流程文档记录 Quickstart 验证与阶段总结",
    file: "docs/governance/iam-specification-governance.md",
    validate: (content) =>
      content.includes("## 8. Quickstart 验证记录") &&
      content.includes("## 9. 阶段评审总结"),
    details: "确保治理文档同步最新验证信息。",
  },
  {
    id: "CC-004",
    description: "存在 Quickstart 验证报告",
    file: "docs/governance/reports/iam-baseline-quickstart.md",
    validate: () => true,
    details: "验证 Quickstart 报告是否已生成。",
  },
  {
    id: "CC-005",
    description: "package.json 注册治理脚本命令",
    file: "package.json",
    validate: (content) =>
      content.includes('"iam:constitution-check"') &&
      content.includes('"iam:milestone-report"'),
    details: "需通过 `package.json` 暴露脚本入口。",
  },
];

function ensureReportDir() {
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }
}

function readFileSafe(relPath) {
  const target = path.join(ROOT, relPath);
  if (!fs.existsSync(target)) {
    return { exists: false, content: "" };
  }
  return {
    exists: true,
    content: fs.readFileSync(target, "utf8"),
  };
}

function parseMarkdownTableLines(lines) {
  const sanitized = lines
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"))
    .filter((line) => {
      const stripped = line.replace(/\|/g, "").trim();
      return !/^[-\s]+$/.test(stripped);
    });
  if (sanitized.length === 0) {
    return { header: [], rows: [] };
  }
  const headerCells = sanitized[0]
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
  const rows = sanitized.slice(1).map((line) => {
    const cells = line
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim());
    const record = {};
    headerCells.forEach((key, index) => {
      record[key] = cells[index] ?? "";
    });
    return record;
  });
  return { header: headerCells, rows };
}

function extractTable(content, heading) {
  const lines = content.split("\n");
  const headingIndex = lines.findIndex((line) =>
    line.trim().startsWith(heading),
  );
  if (headingIndex === -1) {
    return { header: [], rows: [] };
  }
  const tableLines = [];
  for (let i = headingIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === "") {
      if (tableLines.length > 0) break;
      continue;
    }
    if (!line.trim().startsWith("|")) {
      if (tableLines.length > 0) break;
      continue;
    }
    tableLines.push(line);
  }
  return parseMarkdownTableLines(tableLines);
}

function validateReviewTemplate(content) {
  const results = [];
  const checklistTable = extractTable(content, "## 章节检查清单");
  if (checklistTable.rows.length > 0) {
    const invalidRows = checklistTable.rows.filter((row) => {
      const result = row["检查结论"] ?? "";
      return result === "" || result === "-" || /待定|TODO|未填写/.test(result);
    });
    results.push({
      id: "CC-006",
      description: "章节检查结论已填写",
      status: invalidRows.length === 0 ? "passed" : "failed",
      message:
        invalidRows.length === 0
          ? "所有章节均给出明确结论。"
          : `以下章节结论未填写或待定：${invalidRows.map((row) => row["章节"]).join("、")}`,
    });
  }

  const riskTable = extractTable(content, "## 风险与行动项");
  if (riskTable.rows.length > 0) {
    const blockedStatuses = ["跟踪中", "待定", "未开始", ""];
    const activeRisks = riskTable.rows.filter((row) =>
      blockedStatuses.includes(row["状态"] ?? ""),
    );
    results.push({
      id: "CC-007",
      description: "评审风险已关闭",
      status: activeRisks.length === 0 ? "passed" : "failed",
      message:
        activeRisks.length === 0
          ? "风险与行动项表中不存在未关闭风险。"
          : `仍有未关闭风险：${activeRisks.map((row) => row["风险编号"]).join("、")}`,
    });
  }
  return results;
}

function validateExistingReport() {
  const report = readFileSafe(
    "docs/governance/reports/constitution-check.json",
  );
  if (!report.exists) {
    return [
      {
        id: "CC-008",
        description: "存在历史 Constitution Check 报告",
        status: "failed",
        message: "未找到 docs/governance/reports/constitution-check.json",
      },
    ];
  }
  try {
    const payload = JSON.parse(report.content);
    const failed = Number(payload?.summary?.failed ?? 0);
    return [
      {
        id: "CC-008",
        description: "历史 Constitution Check 报告无失败项",
        status: failed === 0 ? "passed" : "failed",
        message:
          failed === 0
            ? "最近一次检查无失败项。"
            : "历史报告存在失败项，请先处理。",
      },
    ];
  } catch (error) {
    return [
      {
        id: "CC-008",
        description: "历史 Constitution Check 报告无失败项",
        status: "failed",
        message: `报告解析失败：${error.message}`,
      },
    ];
  }
}

function runChecks() {
  const results = CHECKS.map((check) => {
    const { exists, content } = readFileSafe(check.file);
    if (!exists) {
      return {
        id: check.id,
        description: check.description,
        status: "failed",
        message: `文件缺失：${check.file}`,
      };
    }
    const passed = check.validate(content);
    return {
      id: check.id,
      description: check.description,
      status: passed ? "passed" : "failed",
      message: passed ? check.details : `校验未通过：${check.details}`,
    };
  });

  const reviewTemplate = readFileSafe(
    "docs/governance/iam-specification-review-template.md",
  );
  if (reviewTemplate.exists) {
    results.push(...validateReviewTemplate(reviewTemplate.content));
  }

  results.push(...validateExistingReport());
  return results;
}

function writeJsonReport(payload) {
  fs.writeFileSync(JSON_PATH, JSON.stringify(payload, null, 2), "utf8");
}

function writeMarkdownReport(payload) {
  const lines = [
    "# Constitution Check 报告",
    "",
    `- 生成时间：${payload.generatedAt}`,
    `- 总计检查：${payload.summary.total} 项`,
    `- 通过：${payload.summary.passed} 项`,
    `- 失败：${payload.summary.failed} 项`,
    "",
    "| ID | 说明 | 状态 | 备注 |",
    "| -- | ---- | ---- | ---- |",
  ];

  payload.checks.forEach((check) => {
    lines.push(
      `| ${check.id} | ${check.description} | ${check.status === "passed" ? "✅" : "❌"} | ${check.message} |`,
    );
  });

  fs.writeFileSync(MD_PATH, lines.join("\n"), "utf8");
}

function main() {
  ensureReportDir();
  const checks = runChecks();
  const passed = checks.filter((item) => item.status === "passed").length;
  const failed = checks.length - passed;
  const payload = {
    generatedAt: new Date().toISOString(),
    summary: {
      total: checks.length,
      passed,
      failed,
    },
    checks,
  };

  writeJsonReport(payload);
  writeMarkdownReport(payload);

  if (failed > 0) {
    console.error("[iam:constitution-check] 检查存在失败项，请查看报告。");
    process.exit(1);
  } else {
    console.info("[iam:constitution-check] 所有检查通过。");
  }
}

main();
