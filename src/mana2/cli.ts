import { spawn } from "node:child_process";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { LayoutDoc } from "../layout/types.js";
import {
  convertToMana2LayoutFile,
  layoutHasMagicRules,
  type Mana2LayoutFile,
} from "./convert.js";

export class Mana2Error extends Error {
  constructor(
    message: string,
    public stderr = "",
  ) {
    super(message);
    this.name = "Mana2Error";
  }
}

export function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9;]*m/g, "");
}

export function defaultMana2Root(): string {
  return path.resolve(process.cwd(), "../mana2");
}

export function sanitizeTempName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "layout"
  );
}

export async function writeTempLayoutFile(
  mana2Root: string,
  tempName: string,
  layoutFile: Mana2LayoutFile,
): Promise<string> {
  const layoutsDir = path.join(mana2Root, "data", "layouts");
  await mkdir(layoutsDir, { recursive: true });
  const filePath = path.join(layoutsDir, `${tempName}.jsonc`);
  await writeFile(filePath, `${JSON.stringify(layoutFile, null, 2)}\n`, "utf8");
  return filePath;
}

export function wrapMana2Command(
  command: string,
  corpus: string,
  options: { engine?: "extended" } = {},
): string {
  const parts: string[] = ["(spacegrams false)"];
  if (options.engine === "extended") {
    parts.push("(engine extended)");
  }
  parts.push(`(corpus ${corpus})`);
  parts.push(`(${command})`);
  return parts.join(" ");
}

function normalizeMana2Output(stdout: string): string {
  const trimmed = stdout.trim();
  const jsonStart = trimmed.indexOf("{");
  return jsonStart === -1 ? trimmed : trimmed.slice(jsonStart);
}

function resolveMana2CliExecutable(): string {
  const configured = process.env.MANA2_CLI?.trim();
  if (configured) return configured;
  return "/usr/local/bin/mana2-cli";
}

export function runMana2Cli(
  mana2Root: string,
  command: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(resolveMana2CliExecutable(), [command], {
      cwd: mana2Root,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolve({ stdout, stderr, exitCode: exitCode ?? 1 });
    });
  });
}

export async function withTempLayout<T>(
  layout: LayoutDoc,
  run: (
    tempName: string,
    mana2Root: string,
    layoutFile: Mana2LayoutFile,
  ) => Promise<T>,
  options: { mana2Root?: string } = {},
): Promise<T> {
  const mana2Root = options.mana2Root ?? process.env.MANA2_ROOT ?? defaultMana2Root();
  const tempName = `.dmini-${sanitizeTempName(layout.name)}-${Date.now()}`;
  const layoutFile = convertToMana2LayoutFile(layout);
  const tempPath = await writeTempLayoutFile(mana2Root, tempName, layoutFile);

  try {
    return await run(tempName, mana2Root, layoutFile);
  } finally {
    await unlink(tempPath).catch(() => undefined);
  }
}

export async function runMana2(
  command: string,
  options: {
    mana2Root?: string;
    corpus?: string;
    engine?: "extended";
  } = {},
): Promise<string> {
  const mana2Root = options.mana2Root ?? process.env.MANA2_ROOT ?? defaultMana2Root();
  const resolved = options.corpus
    ? wrapMana2Command(command, options.corpus, { engine: options.engine })
    : command;
  const { stdout, stderr, exitCode } = await runMana2Cli(mana2Root, resolved);

  if (exitCode !== 0) {
    const message = stripAnsi(stderr.trim() || stdout.trim() || "mana2 command failed");
    throw new Mana2Error(message, stderr);
  }

  return normalizeMana2Output(stdout);
}

export async function runMana2ForLayout(
  layout: LayoutDoc,
  command: string,
  options: { mana2Root?: string; corpus?: string } = {},
): Promise<string> {
  return withTempLayout(
    layout,
    async (tempName, mana2Root) => {
      const resolved = command.replace("{layout}", tempName);
      const engine = layoutHasMagicRules(layout) ? "extended" : undefined;
      const output = await runMana2(resolved, { ...options, mana2Root, engine });

      if (!output) {
        throw new Mana2Error("mana2 returned no output");
      }

      return output;
    },
    options,
  );
}
