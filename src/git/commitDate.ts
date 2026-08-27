import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { defaultMana2Root } from "../mana2/cli.js";

const execFileAsync = promisify(execFile);

export type GitSourceVersion = "latest" | string;

const sourceVersionCache = new Map<string, GitSourceVersion | null>();

function formatCommitDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

async function gitOutput(repoRoot: string, ...args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["-C", repoRoot, ...args]);
    const value = stdout.trim();
    return value || null;
  } catch {
    return null;
  }
}

async function resolveRemoteBranchRef(repoRoot: string): Promise<string | null> {
  const upstreamBranch = await gitOutput(
    repoRoot,
    "rev-parse",
    "--abbrev-ref",
    "--symbolic-full-name",
    "@{u}",
  );
  if (upstreamBranch?.startsWith("origin/")) {
    return `refs/heads/${upstreamBranch.slice("origin/".length)}`;
  }

  const currentBranch = await gitOutput(repoRoot, "rev-parse", "--abbrev-ref", "HEAD");
  if (currentBranch && currentBranch !== "HEAD") {
    return `refs/heads/${currentBranch}`;
  }

  return "refs/heads/main";
}

async function resolveRemoteHead(repoRoot: string): Promise<string | null> {
  const branchRef = await resolveRemoteBranchRef(repoRoot);
  if (!branchRef) return null;

  const remote = await gitOutput(repoRoot, "ls-remote", "origin", branchRef);
  if (!remote) return null;

  const sha = remote.split(/\s+/)[0];
  return sha || null;
}

async function hasWorkingTreeChanges(repoRoot: string): Promise<boolean> {
  const status = await gitOutput(repoRoot, "status", "--porcelain");
  return Boolean(status);
}

async function isAtLatestAvailableCommit(repoRoot: string): Promise<boolean> {
  const [localHead, remoteHead, dirty] = await Promise.all([
    gitOutput(repoRoot, "rev-parse", "HEAD"),
    resolveRemoteHead(repoRoot),
    hasWorkingTreeChanges(repoRoot),
  ]);

  if (!localHead || !remoteHead || dirty) return false;
  return localHead === remoteHead;
}

export async function getGitSourceVersion(
  repoRoot: string,
): Promise<GitSourceVersion | null> {
  const resolved = path.resolve(repoRoot);

  try {
    if (await isAtLatestAvailableCommit(resolved)) {
      return "latest";
    }

    const iso = await gitOutput(resolved, "log", "-1", "--format=%cI");
    return iso ? formatCommitDate(iso) : null;
  } catch (error) {
    console.error(`Failed to read git source version for ${resolved}:`, error);
    return null;
  }
}

export function defaultLayoutApiRoot(): string {
  return path.resolve(process.cwd(), "../layoutapi");
}

export function getDminiSourceVersion(): Promise<GitSourceVersion | null> {
  return getGitSourceVersion(process.cwd());
}

export function getLayoutApiSourceVersion(): Promise<GitSourceVersion | null> {
  const root = process.env.LAYOUTAPI_ROOT?.trim() || defaultLayoutApiRoot();
  return getGitSourceVersion(root);
}

export function getMana2SourceVersion(): Promise<GitSourceVersion | null> {
  const root = process.env.MANA2_ROOT?.trim() || defaultMana2Root();
  return getGitSourceVersion(root);
}

export function sourceFieldLabel(
  name: string,
  version: GitSourceVersion | null,
): string {
  if (!version) return name;
  return `${name} (using ${version})`;
}
