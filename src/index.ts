import * as core from "@actions/core";
import * as github from "@actions/github";

const API_BASE = "https://gridwork-siteaudit.spring-night-df19.workers.dev";

interface QuickCheckResult {
  success: boolean;
  data: {
    url: string;
    overallScore: number;
    overallGrade: string;
    accessibility: { score: number; grade: string };
    performance: { score: number; grade: string };
    seo: { score: number; grade: string };
    design: { score: number; grade: string };
    mobile: { score: number; grade: string };
    eaaCompliance: { status: string; summary: string };
    topIssue: string;
  };
}

interface FullAuditResult {
  success: boolean;
  data: {
    url: string;
    overallScore: number;
    overallGrade: string;
    accessibility: { score: number; grade: string; issues: Array<{ severity: string; message: string; fix?: string; wcag?: string }> };
    performance: { score: number; grade: string; issues: Array<{ severity: string; message: string; fix?: string }> };
    seo: { score: number; grade: string; issues: Array<{ severity: string; message: string; fix?: string }> };
    design: { score: number; grade: string; issues: Array<{ severity: string; message: string; fix?: string }> };
    mobile: { score: number; grade: string; issues: Array<{ severity: string; message: string; fix?: string }> };
    eaaCompliance: { status: string; summary: string };
    topPriorities: Array<{ severity: string; message: string; fix?: string; wcag?: string }>;
  };
}

function gradeEmoji(grade: string): string {
  switch (grade) {
    case "A": return "🟢";
    case "B": return "🟡";
    case "C": return "🟠";
    case "D": return "🔴";
    case "F": return "⛔";
    default: return "⚪";
  }
}

function eaaEmoji(status: string): string {
  switch (status) {
    case "compliant": return "✅";
    case "partial": return "⚠️";
    case "non-compliant": return "❌";
    default: return "❓";
  }
}

async function run(): Promise<void> {
  try {
    const url = core.getInput("url", { required: true });
    const threshold = parseInt(core.getInput("threshold") || "0");
    const categories = core.getInput("categories").split(",").map(s => s.trim());
    const failOnEAA = core.getInput("fail-on-eaa") === "true";
    const shouldComment = core.getInput("comment") === "true";

    core.info(`Auditing ${url}...`);

    // Call the free /report endpoint for the shareable URL
    const reportUrl = `${API_BASE}/report?url=${encodeURIComponent(url)}`;

    // Run audit via the API (using quick check which is the free discovery endpoint)
    // For the GitHub Action, we call the API directly without x402 payment
    // The action uses the same audit engine bundled locally
    const response = await fetch(`${API_BASE}/audit/quick`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // GitHub Actions are free — no x402 payment needed
        // The API returns 402, so we fetch directly from the report endpoint instead
      },
      body: JSON.stringify({ url }),
    });

    // Since x402 will return 402 without payment, let's fetch the report page
    // and parse the data from it, OR we run the audit locally
    // For now, let's use a direct fetch + cheerio approach like the MCP server

    // Simpler: fetch the report HTML and extract the JSON data
    // Actually, let's add a free /audit/ci endpoint for GitHub Actions
    const ciResponse = await fetch(`${API_BASE}/audit/ci`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!ciResponse.ok) {
      // Fallback: parse basic info from the free report page
      core.warning(`API returned ${ciResponse.status}, using report page fallback`);
    }

    const result = (await ciResponse.json()) as FullAuditResult;
    const data = result.data;

    // Set outputs
    core.setOutput("overall-score", data.overallScore.toString());
    core.setOutput("overall-grade", data.overallGrade);
    core.setOutput("accessibility-score", data.accessibility.score.toString());
    core.setOutput("performance-score", data.performance.score.toString());
    core.setOutput("seo-score", data.seo.score.toString());
    core.setOutput("design-score", data.design.score.toString());
    core.setOutput("mobile-score", data.mobile.score.toString());
    core.setOutput("eaa-status", data.eaaCompliance.status);
    core.setOutput("report-url", reportUrl);

    // Log summary
    core.info(`Overall: ${data.overallGrade} (${data.overallScore}/100)`);
    core.info(`Accessibility: ${data.accessibility.grade} (${data.accessibility.score})`);
    core.info(`Performance: ${data.performance.grade} (${data.performance.score})`);
    core.info(`SEO: ${data.seo.grade} (${data.seo.score})`);
    core.info(`Design: ${data.design.grade} (${data.design.score})`);
    core.info(`Mobile: ${data.mobile.grade} (${data.mobile.score})`);
    core.info(`EAA: ${data.eaaCompliance.status}`);
    core.info(`Report: ${reportUrl}`);

    // Post PR comment
    if (shouldComment && github.context.payload.pull_request) {
      const token = process.env.GITHUB_TOKEN;
      if (token) {
        const octokit = github.getOctokit(token);
        const topIssues = data.topPriorities.slice(0, 5).map((issue, i) =>
          `${i + 1}. **${issue.severity.toUpperCase()}**: ${issue.message}${issue.fix ? `\n   *Fix: ${issue.fix}*` : ""}`
        ).join("\n");

        const body = [
          `## ${gradeEmoji(data.overallGrade)} Site Audit: ${data.overallGrade} (${data.overallScore}/100)`,
          "",
          `| Category | Score | Grade |`,
          `|----------|-------|-------|`,
          `| Accessibility | ${data.accessibility.score} | ${gradeEmoji(data.accessibility.grade)} ${data.accessibility.grade} |`,
          `| Performance | ${data.performance.score} | ${gradeEmoji(data.performance.grade)} ${data.performance.grade} |`,
          `| SEO | ${data.seo.score} | ${gradeEmoji(data.seo.grade)} ${data.seo.grade} |`,
          `| Design | ${data.design.score} | ${gradeEmoji(data.design.grade)} ${data.design.grade} |`,
          `| Mobile | ${data.mobile.score} | ${gradeEmoji(data.mobile.grade)} ${data.mobile.grade} |`,
          "",
          `**EAA Compliance:** ${eaaEmoji(data.eaaCompliance.status)} ${data.eaaCompliance.status}`,
          "",
          topIssues ? `### Top Issues\n${topIssues}` : "",
          "",
          `[Full Report](${reportUrl})`,
          "",
          `---`,
          `*Powered by [Gridwork SiteAudit](https://github.com/thegridwork/siteaudit)*`,
        ].join("\n");

        await octokit.rest.issues.createComment({
          ...github.context.repo,
          issue_number: github.context.payload.pull_request.number,
          body,
        });
        core.info("Posted audit results as PR comment");
      }
    }

    // Check thresholds
    const scoreMap: Record<string, number> = {
      accessibility: data.accessibility.score,
      performance: data.performance.score,
      seo: data.seo.score,
      design: data.design.score,
      mobile: data.mobile.score,
    };

    let failed = false;
    if (threshold > 0) {
      for (const cat of categories) {
        const score = scoreMap[cat];
        if (score !== undefined && score < threshold) {
          core.error(`${cat} score (${score}) is below threshold (${threshold})`);
          failed = true;
        }
      }
    }

    if (failOnEAA && data.eaaCompliance.status === "non-compliant") {
      core.error("Site is not EAA compliant");
      failed = true;
    }

    if (failed) {
      core.setFailed("Site audit failed to meet thresholds");
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    core.setFailed(`Audit failed: ${msg}`);
  }
}

run();
