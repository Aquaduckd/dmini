import { randomUUID } from "node:crypto";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Interaction,
  type Message,
} from "discord.js";
import { infoEmbed } from "./embeds.js";
import { formatPaginationFooter } from "./pagination.js";
import {
  deletePaginationSession,
  readPaginationSession,
  sweepExpiredPaginationSessions,
  writePaginationSession,
} from "./pagination/store.js";
import type {
  PaginationSessionKind,
  PaginationSessionRecord,
  PaginationSessionState,
} from "./pagination/types.js";

export { PaginatedContentTooLongError, resolvePaginatedLimit } from "./pagination/limit.js";
export type { PaginatedPage } from "./pagination/types.js";

const SESSION_PREFIX = "dmini:pg:";
export const SESSION_TTL_MS = 10 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;

export interface PaginatedReplyOptions {
  title: string;
  userId: string;
  initialPage: number;
  kind: PaginationSessionKind;
  state: PaginationSessionState;
}

function parseButtonAction(
  customId: string,
): { sessionId: string; action: "prev" | "next" } | null {
  if (!customId.startsWith(SESSION_PREFIX)) return null;

  const rest = customId.slice(SESSION_PREFIX.length);
  const separator = rest.lastIndexOf(":");
  if (separator <= 0) return null;

  const sessionId = rest.slice(0, separator);
  const action = rest.slice(separator + 1);
  if (action !== "prev" && action !== "next") return null;

  return { sessionId, action };
}

function buildPaginationRow(
  sessionId: string,
  pagination: Parameters<typeof formatPaginationFooter>[0],
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${SESSION_PREFIX}${sessionId}:prev`)
      .setLabel("◀ Prev")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pagination.page <= 1),
    new ButtonBuilder()
      .setCustomId(`${SESSION_PREFIX}${sessionId}:next`)
      .setLabel("Next ▶")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pagination.page >= pagination.pageCount),
  );
}

function disabledPaginationRow(
  sessionId: string,
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${SESSION_PREFIX}${sessionId}:prev`)
      .setLabel("◀ Prev")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`${SESSION_PREFIX}${sessionId}:next`)
      .setLabel("Next ▶")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
  );
}

function expireSession(sessionId: string): void {
  void deletePaginationSession(sessionId);
}

function ensureSweepTimer(): void {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => {
    void sweepExpiredPaginationSessions(SESSION_TTL_MS);
  }, SWEEP_INTERVAL_MS);
  sweepTimer.unref?.();
}

let sweepTimer: ReturnType<typeof setInterval> | undefined;

async function renderPage(
  record: PaginationSessionRecord,
  targetPage: number,
) {
  const { renderPaginationPage } = await import("./pagination/render.js");
  return renderPaginationPage(record, targetPage);
}

function applyRenderResult(
  record: PaginationSessionRecord,
  rendered: Awaited<ReturnType<typeof renderPage>>,
): void {
  if (rendered.effectiveLimit !== undefined) {
    record.effectiveLimit = rendered.effectiveLimit;
  }
  record.currentPage = rendered.page.pagination.page;
}

export async function replyPaginated(
  message: Message,
  options: PaginatedReplyOptions,
): Promise<void> {
  ensureSweepTimer();
  await sweepExpiredPaginationSessions(SESSION_TTL_MS);

  const sessionId = randomUUID();
  const record: PaginationSessionRecord = {
    id: sessionId,
    userId: options.userId,
    title: options.title,
    kind: options.kind,
    state: options.state,
    currentPage: options.initialPage,
    createdAt: new Date().toISOString(),
  };

  const rendered = await renderPage(record, options.initialPage);
  applyRenderResult(record, rendered);
  await writePaginationSession(record);

  const components =
    rendered.page.pagination.pageCount > 1
      ? [buildPaginationRow(sessionId, rendered.page.pagination)]
      : [];

  const embed = infoEmbed(options.title, rendered.page.description).setFooter({
    text: formatPaginationFooter(rendered.page.pagination),
  });

  await message.reply({ embeds: [embed], components });
}

export async function handlePaginationInteraction(
  interaction: Interaction,
): Promise<boolean> {
  if (!interaction.isButton()) return false;

  const parsed = parseButtonAction(interaction.customId);
  if (!parsed) return false;

  const session = await readPaginationSession(parsed.sessionId, SESSION_TTL_MS);
  if (!session) {
    await interaction.reply({
      content: "This pagination session has expired. Run the command again.",
      ephemeral: true,
    });
    return true;
  }

  if (interaction.user.id !== session.userId) {
    await interaction.reply({
      content: "Only the user who ran this command can use these buttons.",
      ephemeral: true,
    });
    return true;
  }

  const nextPage =
    parsed.action === "prev"
      ? Math.max(1, session.currentPage - 1)
      : Math.min(session.currentPage + 1, Number.MAX_SAFE_INTEGER);

  await interaction.deferUpdate();

  try {
    const rendered = await renderPage(session, nextPage);
    applyRenderResult(session, rendered);
    await writePaginationSession(session);

    const embed = infoEmbed(session.title, rendered.page.description).setFooter({
      text: formatPaginationFooter(rendered.page.pagination),
    });

    const components =
      rendered.page.pagination.pageCount > 1
        ? [buildPaginationRow(parsed.sessionId, rendered.page.pagination)]
        : [];

    await interaction.editReply({ embeds: [embed], components });
  } catch {
    expireSession(parsed.sessionId);

    const embed = infoEmbed(
      session.title,
      "Failed to load this page. Run the command again.",
    );

    await interaction.editReply({
      embeds: [embed],
      components: [disabledPaginationRow(parsed.sessionId)],
    });
  }

  return true;
}
