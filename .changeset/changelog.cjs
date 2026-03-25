"use strict";

const fs = require("node:fs");
const path = require("node:path");

function loadTemplate(options = {}) {
  const templatePath = options.releaseNoteTemplate
    ? path.resolve(process.cwd(), options.releaseNoteTemplate)
    : path.resolve(process.cwd(), ".changeset", "release-note-template.txt");

  const fallback = {
    summary: "Summary",
    breaking: "Breaking",
    packages: "Packages",
  };

  try {
    const source = fs.readFileSync(templatePath, "utf8");
    const headings = Array.from(source.matchAll(/^##\s+(.+)$/gm)).map((match) => match[1].trim());
    return {
      summary: headings[0] || fallback.summary,
      breaking: headings[1] || fallback.breaking,
      packages: headings[2] || fallback.packages,
    };
  } catch {
    return fallback;
  }
}

function toLines(summary) {
  return summary
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitBreaking(lines) {
  const breaking = [];
  const regular = [];

  for (const line of lines) {
    if (/^BREAKING(?: CHANGE)?:/i.test(line)) {
      breaking.push(line.replace(/^BREAKING(?: CHANGE)?:\s*/i, "").trim());
      continue;
    }

    regular.push(line);
  }

  return {
    regular,
    breaking,
  };
}

function formatBulletLine(text, commit, repo) {
  if (!commit) {
    return `- ${text}`;
  }

  if (repo) {
    return `- [\`${commit.slice(0, 7)}\`](https://github.com/${repo}/commit/${commit}) ${text}`;
  }

  return `- \`${commit.slice(0, 7)}\` ${text}`;
}

function formatSection(title, bullets) {
  return `### ${title}\n${bullets.join("\n")}`;
}

async function getReleaseLine(changeset, _type, options = {}) {
  const labels = loadTemplate(options);
  const lines = toLines(changeset.summary);
  const { regular, breaking } = splitBreaking(lines);

  const summaryBullets =
    regular.length > 0
      ? regular.map((line) => formatBulletLine(line, changeset.commit, options.repo))
      : ["- What changed for users?"];

  const breakingBullets =
    breaking.length > 0
      ? breaking.map((line) => `- ${line}`)
      : ["- None"];

  return [
    formatSection(labels.summary, summaryBullets),
    formatSection(labels.breaking, breakingBullets),
  ].join("\n\n");
}

async function getDependencyReleaseLine(_changesets, dependenciesUpdated, options = {}) {
  if (dependenciesUpdated.length === 0) {
    return "";
  }

  const labels = loadTemplate(options);
  const bullets = dependenciesUpdated.map(
    (dependency) => `- \`${dependency.name}@${dependency.newVersion}\`: dependency range update`,
  );

  return formatSection(labels.packages, bullets);
}

module.exports = {
  getReleaseLine,
  getDependencyReleaseLine,
};
