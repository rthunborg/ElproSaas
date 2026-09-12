/**
 * Lightweight freshness check for the author-owned Suggested Review Order trail.
 *
 * This deliberately validates only the supplied story/spec documents. It is not a
 * repository-wide historical-story sweep, nor does it try to judge the prose.
 */
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REVIEW_ORDER_HEADING = "## Suggested Review Order";
const FENCE_START = /^ {0,3}(`{3,}|~{3,})/;
const HEADING_ONE_OR_TWO = /^ {0,3}#{1,2}(?:\s|$)/;
const CANONICAL_STOP_WITH_COLON_ANCHOR = /^- `([^`]+):(\d+)` — `([^`]+)`: (.+?)\s*$/;
const CANONICAL_STOP_WITH_SPACE_ANCHOR = /^- `([^`]+):(\d+)` — (?:`([^`]+)` )?(.+?)\s*$/;
const CODE_PATH_REFERENCE = /`([^`]+):(\d+)`/g;

function isFenceStart(line) {
  return FENCE_START.exec(line);
}

function isFenceEnd(line, marker) {
  const escaped = marker[0] === "`" ? "`" : "~";
  return new RegExp(`^ {0,3}${escaped}{${marker.length},}\\s*$`).test(line);
}

/**
 * Find exact level-two review-order headings outside Markdown fenced blocks.
 * The returned section ends at the next H1/H2, also outside a fenced block.
 */
export function parseSuggestedReviewOrder(markdown) {
  const lines = markdown.split(/\r?\n/);
  const headings = [];
  let fence = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (fence) {
      if (isFenceEnd(line, fence)) fence = null;
      continue;
    }
    const marker = isFenceStart(line);
    if (marker) {
      fence = marker[1];
      continue;
    }
    if (line === REVIEW_ORDER_HEADING) headings.push(index);
  }

  if (headings.length !== 1) {
    return { lines, headingLines: headings.map((index) => index + 1), body: [] };
  }

  const start = headings[0] + 1;
  fence = null;
  let end = lines.length;
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index];
    if (fence) {
      if (isFenceEnd(line, fence)) fence = null;
      continue;
    }
    const marker = isFenceStart(line);
    if (marker) {
      fence = marker[1];
      continue;
    }
    if (HEADING_ONE_OR_TWO.test(line)) {
      end = index;
      break;
    }
  }
  return {
    lines,
    headingLines: [headings[0] + 1],
    body: lines.slice(start, end).map((text, offset) => ({ line: start + offset + 1, text })),
  };
}

function pathError(rootDir, citedPath) {
  if (
    citedPath.includes("\\") ||
    /^[A-Za-z]:/.test(citedPath) ||
    citedPath.startsWith("/") ||
    citedPath.split("/").includes("..") ||
    isAbsolute(citedPath)
  ) {
    return "must be a repository-relative path without traversal, a drive prefix, or backslashes";
  }

  const root = resolve(rootDir);
  const candidate = resolve(root, citedPath);
  const outside = relative(root, candidate);
  if (outside === ".." || outside.startsWith(`..${sep}`) || isAbsolute(outside)) {
    return "resolves outside the repository";
  }
  if (!existsSync(candidate)) return "does not exist in the repository";
  try {
    if (!statSync(candidate).isFile()) return "must reference a regular file";
    const actualRoot = realpathSync(root);
    const actualCandidate = realpathSync(candidate);
    const actualOutside = relative(actualRoot, actualCandidate);
    if (actualOutside === ".." || actualOutside.startsWith(`..${sep}`) || isAbsolute(actualOutside)) {
      return "resolves outside the repository through a symbolic link";
    }
  } catch {
    return "cannot be read as a regular repository file";
  }
  return null;
}

function validateReference(rootDir, citedPath, lineNumber, anchor, sourceLine) {
  const errors = [];
  const pathProblem = pathError(rootDir, citedPath);
  if (pathProblem) return [`${sourceLine}: \`${citedPath}:${lineNumber}\` ${pathProblem}`];

  const targetPath = resolve(rootDir, citedPath);
  let source;
  try {
    source = readFileSync(targetPath, "utf8");
  } catch {
    return [`${sourceLine}: \`${citedPath}:${lineNumber}\` cannot be read`];
  }
  const targetLines = source.split(/\r?\n/);
  // A final newline terminates the last source line; it does not create another
  // addressable review stop line.
  if (targetLines.at(-1) === "" && /\r?\n$/.test(source)) targetLines.pop();
  const line = Number(lineNumber);
  if (!Number.isSafeInteger(line) || line < 1 || line > targetLines.length) {
    errors.push(`${sourceLine}: \`${citedPath}:${lineNumber}\` is outside the file's line range (1-${targetLines.length})`);
  } else if (anchor && !targetLines[line - 1].includes(anchor)) {
    errors.push(`${sourceLine}: anchor \`${anchor}\` was not found on \`${citedPath}:${lineNumber}\``);
  }
  return errors;
}

function entriesOutsideFences(entries) {
  const visible = [];
  let fence = null;
  for (const entry of entries) {
    if (fence) {
      if (isFenceEnd(entry.text, fence)) fence = null;
      continue;
    }
    const marker = isFenceStart(entry.text);
    if (marker) {
      fence = marker[1];
      continue;
    }
    visible.push(entry);
  }
  return visible;
}

function parseCanonicalStop(text) {
  const colon = CANONICAL_STOP_WITH_COLON_ANCHOR.exec(text);
  if (colon) {
    const [, citedPath, lineNumber, anchor, framing] = colon;
    return { citedPath, lineNumber, anchor, framing };
  }
  const spaced = CANONICAL_STOP_WITH_SPACE_ANCHOR.exec(text);
  if (!spaced) return null;
  const [, citedPath, lineNumber, anchor, framing] = spaced;
  return { citedPath, lineNumber, anchor, framing };
}

/**
 * Pure validation of author-provided stops. `rootDir` is supplied explicitly so
 * unit tests can use a temporary repository without scanning this checkout.
 */
export function validateSuggestedReviewOrder(markdown, rootDir) {
  const parsed = parseSuggestedReviewOrder(markdown);
  const errors = [];
  const present = parsed.headingLines.length > 0;

  if (parsed.headingLines.length === 0) errors.push("missing exact `## Suggested Review Order` section outside fenced code blocks");
  if (parsed.headingLines.length > 1) errors.push(`duplicate exact \`## Suggested Review Order\` sections at lines ${parsed.headingLines.join(", ")}`);
  if (parsed.headingLines.length !== 1) {
    return { sectionPresent: present, mode: "author-section-present", refsCount: 0, errors };
  }

  const visibleBody = entriesOutsideFences(parsed.body);
  const meaningful = visibleBody.filter(({ text }) => text.trim().length > 0);
  if (meaningful.length === 0) errors.push("Suggested Review Order section is empty");

  const references = [];
  const stops = [];
  for (const entry of visibleBody) {
    const stop = parseCanonicalStop(entry.text);
    if (stop) {
      stops.push({ ...entry, ...stop });
    }
    for (const match of entry.text.matchAll(CODE_PATH_REFERENCE)) {
      references.push({ ...entry, citedPath: match[1], lineNumber: match[2] });
    }
  }
  if (stops.length === 0) errors.push("Suggested Review Order needs at least one concrete canonical review stop");

  // Validate every cited path:line in the section. A canonical stop gets its
  // optional immediate anchor checked on the cited source line.
  for (const reference of references) {
    const matchingStop = stops.find(
      (stop) =>
        stop.line === reference.line &&
        stop.citedPath === reference.citedPath &&
        stop.lineNumber === reference.lineNumber,
    );
    errors.push(
      ...validateReference(
        rootDir,
        reference.citedPath,
        reference.lineNumber,
        matchingStop?.anchor,
        `review-order line ${reference.line}`,
      ),
    );
  }

  return {
    sectionPresent: true,
    mode: stops.length > 0 ? "full-trail-candidate" : "author-section-present",
    refsCount: references.length,
    errors,
  };
}

/** Validate one supplied Markdown file and retain its user-facing path in the report. */
export function validateReviewOrderFile(filePath, rootDir) {
  if (!existsSync(filePath)) {
    return { filePath, sectionPresent: false, mode: "author-section-present", refsCount: 0, errors: ["document does not exist"] };
  }
  try {
    return { filePath, ...validateSuggestedReviewOrder(readFileSync(filePath, "utf8"), rootDir) };
  } catch {
    return { filePath, sectionPresent: false, mode: "author-section-present", refsCount: 0, errors: ["document cannot be read"] };
  }
}

function normalize(value) {
  return String(value).replace(/\\/g, "/").toLowerCase();
}

const invokedDirectly = process.argv[1] && normalize(fileURLToPath(import.meta.url)) === normalize(process.argv[1]);
if (invokedDirectly) {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const supplied = process.argv.slice(2);
  const reports = supplied.length === 0
    ? [{ filePath: null, sectionPresent: false, mode: "author-section-present", refsCount: 0, errors: ["supply at least one story or spec Markdown file"] }]
    : supplied.map((filePath) => validateReviewOrderFile(filePath, repoRoot));
  console.log(JSON.stringify({ reports }, null, 2));
  if (reports.some((report) => report.errors.length > 0)) process.exitCode = 1;
}
