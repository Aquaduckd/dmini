import { PREFIX } from "../command/constants.js";
import { defaultMana2Root, runMana2Cli, stripAnsi } from "./cli.js";

export interface CorpusList {
  downloaded: string[];
  available: string[];
}

export class CorpusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CorpusError";
  }
}

export async function listCorpora(
  options: { mana2Root?: string } = {},
): Promise<CorpusList> {
  const mana2Root = options.mana2Root ?? process.env.MANA2_ROOT ?? defaultMana2Root();
  const { stdout, stderr, exitCode } = await runMana2Cli(mana2Root, "corpus");

  if (exitCode !== 0) {
    throw new Error(stripAnsi(stderr.trim() || stdout.trim() || "Failed to list corpora"));
  }

  const downloaded: string[] = [];
  const available: string[] = [];
  let section: "downloaded" | "available" = "downloaded";

  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("Not downloaded")) {
      section = "available";
      continue;
    }

    const name = trimmed.replace(/^\s+/, "");
    if (!name || name.startsWith("Not downloaded")) continue;

    if (section === "downloaded") {
      downloaded.push(name);
    } else {
      available.push(name);
    }
  }

  return { downloaded, available };
}

export async function resolveDownloadedCorpus(name: string): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new CorpusError("Corpus name cannot be empty.");
  }

  const { downloaded, available } = await listCorpora();
  const match = downloaded.find(
    (corpus) => corpus.toLowerCase() === trimmed.toLowerCase(),
  );

  if (match) return match;

  const pending = available.find(
    (corpus) => corpus.toLowerCase() === trimmed.toLowerCase(),
  );

  if (pending) {
    throw new CorpusError(
      `Corpus \`${trimmed}\` is not downloaded. An admin can fetch it with \`${PREFIX}debug corpus get ${pending}\`.`,
    );
  }

  throw new CorpusError(
    `Unknown corpus \`${trimmed}\`. Use \`${PREFIX}config corpus\` to see downloaded corpora.`,
  );
}

function findKnownCorpus(name: string, corpora: CorpusList): string | null {
  return (
    [...corpora.downloaded, ...corpora.available].find(
      (corpus) => corpus.toLowerCase() === name.toLowerCase(),
    ) ?? null
  );
}

export async function downloadCorpus(name: string): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new CorpusError("Corpus name cannot be empty.");
  }

  const mana2Root = process.env.MANA2_ROOT ?? defaultMana2Root();
  const corpora = await listCorpora({ mana2Root });
  const known = findKnownCorpus(trimmed, corpora);

  if (!known) {
    throw new CorpusError(
      `Unknown corpus \`${trimmed}\`. Use \`${PREFIX}debug corpus\` to see downloadable corpora.`,
    );
  }

  if (
    corpora.downloaded.some(
      (corpus) => corpus.toLowerCase() === known.toLowerCase(),
    )
  ) {
    return known;
  }

  const { stdout, stderr, exitCode } = await runMana2Cli(mana2Root, `get ${known}`);

  if (exitCode !== 0) {
    throw new CorpusError(
      stripAnsi(stderr.trim() || stdout.trim() || `Failed to download \`${known}\`.`),
    );
  }

  return known;
}

export interface DownloadAllResult {
  downloaded: string[];
  skipped: string[];
  failed: Array<{ name: string; message: string }>;
}

export async function downloadAllCorpora(
  options: { mana2Root?: string } = {},
): Promise<DownloadAllResult> {
  const mana2Root = options.mana2Root ?? process.env.MANA2_ROOT ?? defaultMana2Root();
  const corpora = await listCorpora({ mana2Root });
  const downloaded: string[] = [];
  const skipped = [...corpora.downloaded];
  const failed: DownloadAllResult["failed"] = [];

  for (const name of corpora.available) {
    try {
      downloaded.push(await downloadCorpus(name));
    } catch (error) {
      failed.push({
        name,
        message:
          error instanceof CorpusError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Download failed",
      });
    }
  }

  return { downloaded, skipped, failed };
}
