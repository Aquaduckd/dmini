import type { Message } from "discord.js";
import {
  resolveAuthorNameByUserId,
  resolveAuthorUserId,
} from "../api/authors.js";
import {
  fetchLayoutDoc,
  formatWriteApiError,
  LayoutApiError,
  LayoutNotFoundError,
  updateLayout,
} from "../api/layouts.js";
import { PREFIX } from "../command/constants.js";
import { replyUsage } from "../command/format.js";
import type { Command } from "../command/types.js";
import { errorEmbed, infoEmbed, replyEmbed } from "../discord/embeds.js";
import {
  createPendingGift,
  findPendingGiftsFromSender,
  GiftStoreError,
  removePendingGift,
} from "../gifts/store.js";
import { formatGiftExpiry, type PendingGift } from "../gifts/types.js";
import { layoutOwnedByUser } from "../layout/types.js";

export const giftCommand: Command = {
  name: "gift",
  description: "Offer one of your layouts to another author",
  usage: `${PREFIX}gift <username> <layout> | ${PREFIX}gift accept <username> [layout]`,
  group: "Social",
  examples: [
    `${PREFIX}gift galileotime opal`,
    `${PREFIX}gift accept galileotime`,
  ],
  async execute({ message, args }) {
    const trimmed = args.trim();
    if (!trimmed) {
      await replyUsage({ message, args }, giftCommand);
      return;
    }

    const parts = trimmed.split(/\s+/).filter(Boolean);
    const action = parts[0]!.toLowerCase();

    if (action === "accept") {
      await handleGiftAccept(message, parts.slice(1));
      return;
    }

    if (parts.length < 2) {
      await replyUsage({ message, args }, giftCommand);
      return;
    }

    const recipientQuery = parts[0]!;
    const layoutQuery = parts.slice(1).join(" ");
    await handleGiftOffer(message, recipientQuery, layoutQuery);
  },
};

async function handleGiftOffer(
  message: Message,
  recipientQuery: string,
  layoutQuery: string,
): Promise<void> {
  const recipient = await resolveAuthorUserId(recipientQuery);
  if (!recipient) {
    await replyEmbed(
      message,
      errorEmbed(`Unknown author \`${recipientQuery}\`.`),
    );
    return;
  }

  if (recipient.id === message.author.id) {
    await replyEmbed(message, errorEmbed("You can't gift a layout to yourself."));
    return;
  }

  const senderName = await resolveAuthorNameByUserId(message.author.id);
  if (!senderName) {
    await replyEmbed(
      message,
      errorEmbed(
        "You aren't in the authors registry, so other users couldn't accept a gift from you.",
      ),
    );
    return;
  }

  try {
    const layout = await fetchLayoutDoc(layoutQuery);

    if (!layoutOwnedByUser(layout, message.author.id)) {
      await replyEmbed(
        message,
        errorEmbed(`You don't own any layout named \`${layoutQuery}\`.`),
      );
      return;
    }

    const gift = await createPendingGift({
      layout: layout.name,
      fromUserId: message.author.id,
      fromUsername: senderName,
      toUserId: recipient.id,
      toUsername: recipient.name,
    });

    await replyEmbed(
      message,
      infoEmbed(
        "Gift offer sent",
        [
          `\`${layout.name}\` offered to \`${recipient.name}\`.`,
          `They can accept with \`${PREFIX}gift accept ${senderName}\`.`,
          `Expires ${formatGiftExpiry(gift.expiresAt)}.`,
        ].join("\n"),
      ),
    );
  } catch (error) {
    await handleGiftError(message, error, "offer");
  }
}

async function handleGiftAccept(
  message: Message,
  args: string[],
): Promise<void> {
  const senderQuery = args[0]?.trim();
  if (!senderQuery) {
    await replyEmbed(
      message,
      errorEmbed("Missing sender username.", "Usage").setDescription(
        `Usage: \`${PREFIX}gift accept <username> [layout]\``,
      ),
    );
    return;
  }

  const sender = await resolveAuthorUserId(senderQuery);
  if (!sender) {
    await replyEmbed(
      message,
      errorEmbed(`Unknown author \`${senderQuery}\`.`),
    );
    return;
  }

  const pending = await findPendingGiftsFromSender(message.author.id, sender.name);
  if (pending.length === 0) {
    await replyEmbed(
      message,
      errorEmbed(`You don't have any pending gifts from \`${sender.name}\`.`),
    );
    return;
  }

  const layoutQuery = args.slice(1).join(" ").trim();
  let gift: PendingGift | undefined;

  if (layoutQuery) {
    gift = pending.find(
      (entry) => entry.layout.toLowerCase() === layoutQuery.toLowerCase(),
    );
    if (!gift) {
      await replyEmbed(
        message,
        errorEmbed(
          `You don't have a pending gift for \`${layoutQuery}\` from \`${sender.name}\`.`,
        ),
      );
      return;
    }
  } else if (pending.length > 1) {
    const layouts = pending.map((entry) => `\`${entry.layout}\``).join(", ");
    await replyEmbed(
      message,
      errorEmbed(
        `Multiple pending gifts from \`${sender.name}\`: ${layouts}. Use \`${PREFIX}gift accept ${sender.name} <layout>\`.`,
      ),
    );
    return;
  } else {
    gift = pending[0];
  }

  await completeGift(message, gift!);
}

async function completeGift(message: Message, gift: PendingGift): Promise<void> {
  try {
    const layout = await fetchLayoutDoc(gift.layout);

    if (!layoutOwnedByUser(layout, gift.fromUserId)) {
      await removePendingGift(gift.layout, gift.toUserId, gift.fromUserId);
      await replyEmbed(
        message,
        errorEmbed(
          `\`${gift.fromUsername}\` no longer owns \`${gift.layout}\`, so this gift offer was cancelled.`,
        ),
      );
      return;
    }

    if (gift.toUserId !== message.author.id) {
      await replyEmbed(
        message,
        errorEmbed("This gift offer wasn't sent to you."),
      );
      return;
    }

    layout.user = gift.toUserId;
    await updateLayout(layout);
    await removePendingGift(gift.layout, gift.toUserId, gift.fromUserId);

    await replyEmbed(
      message,
      infoEmbed(
        "Gift accepted",
        `\`${gift.layout}\` is now yours. It was gifted by \`${gift.fromUsername}\`.`,
      ),
    );
  } catch (error) {
    await handleGiftError(message, error, "accept");
  }
}

async function handleGiftError(
  message: Message,
  error: unknown,
  action: "offer" | "accept",
): Promise<void> {
  if (error instanceof LayoutNotFoundError) {
    await replyEmbed(message, errorEmbed(error.formatMessage()));
    return;
  }

  if (error instanceof GiftStoreError) {
    await replyEmbed(message, errorEmbed(error.message));
    return;
  }

  if (error instanceof LayoutApiError) {
    await replyEmbed(message, errorEmbed(formatWriteApiError(error)));
    return;
  }

  if (error instanceof Error && error.message.includes("LAYOUTAPI_TOKEN")) {
    await replyEmbed(message, errorEmbed(error.message));
    return;
  }

  console.error(`Failed to ${action} layout gift:`, error);
  await replyEmbed(message, errorEmbed(`Failed to ${action} layout gift.`));
}
