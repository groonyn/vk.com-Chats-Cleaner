/**
 * VK Messenger Chat Cleaner - Main deletion logic
 */

import { VKApi } from './vkapi';
import { ProgressUI } from './progress';

export interface CleanerOptions {
  accessToken?: string;
  bothSides?: boolean;
  dryRun?: boolean;
}

export class VKMessengerCleaner {
  private api: VKApi;
  private progress: ProgressUI;
  private options: CleanerOptions;

  constructor(options: CleanerOptions = {}) {
    this.options = options;
    this.api = new VKApi(options.accessToken);
    this.progress = new ProgressUI();
  }

  /**
   * Ask for confirmation in Node.js terminal
   */
  private async askConfirmationNode(count: number): Promise<boolean> {
    if (typeof require === 'undefined') {
      return false;
    }
    try {
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      return new Promise(resolve => {
        rl.question(
          `\n\x1b[33m\x1b[1m⚠️  WARNING\x1b[0m\n` +
          `\x1b[33mThis will permanently delete ${count} conversations!\x1b[0m\n` +
          `\x1b[33mThis action CANNOT be undone!\x1b[0m\n\n` +
          `Type \x1b[1mDELETE\x1b[0m to confirm: `,
          (answer: string) => {
            rl.close();
            resolve(answer.trim() === 'DELETE');
          }
        );
      });
    } catch (e) {
      return false;
    }
  }

  /**
   * Fetch all conversations (with pagination)
   */
  private async fetchAllConversations(): Promise<number[]> {
    const peerIds: number[] = [];
    let offset = 0;
    const batchSize = 100;
    let hasMore = true;

    this.progress.logInfo('Fetching all conversations...');

    while (hasMore) {
      const result = await this.api.getConversations(offset, batchSize);

      if (!result) {
        this.progress.logError('Failed to fetch conversations');
        break;
      }

      const items = result.items || [];

      if (items.length === 0) {
        hasMore = false;
        break;
      }

      for (const item of items) {
        const peerId = item.conversation.peer.id;
        peerIds.push(peerId);
      }

      offset += items.length;

      if (items.length < batchSize) {
        hasMore = false;
      }
    }

    return peerIds;
  }

  /**
   * Delete conversations
   */
  private async deleteConversations(peerIds: number[]): Promise<void> {
    this.progress.start(peerIds.length);

    let currentUserId: number | null = null;
    if (this.options.bothSides) {
      const user = await this.api.getCurrentUser();
      if (user) {
        currentUserId = user.id;
      }
    }

    for (let i = 0; i < peerIds.length; i++) {
      const peerId = peerIds[i];

      if (this.options.dryRun) {
        this.progress.logDeletion(peerId, true, 'DRY RUN - Skipped');
        continue;
      }

      let bothSidesSuccessStr = '';

      if (this.options.bothSides && currentUserId !== null) {
        try {
          // Fetch messages history
          const history = await this.api.getHistory(peerId, 0, 200);
          if (history && history.items && history.items.length > 0) {
            const now = Date.now() / 1000;
            // Filter messages sent by current user within 24 hours
            const messagesToDelete = history.items.filter(
              msg => msg.from_id === currentUserId && now - msg.date < 24 * 3600
            );

            if (messagesToDelete.length > 0) {
              const messageIds = messagesToDelete.map(msg => msg.id);
              const deletedForAll = await this.api.deleteMessages(messageIds, true);
              if (deletedForAll) {
                bothSidesSuccessStr = `deleted ${messageIds.length} messages for all`;
              } else {
                bothSidesSuccessStr = `failed to delete ${messageIds.length} messages for all`;
              }
            } else {
              bothSidesSuccessStr = 'no messages found <24h';
            }
          }
        } catch (err) {
          bothSidesSuccessStr = 'error checking history';
        }
      }

      // Delete conversation on user side
      const success = await this.api.deleteConversation(peerId);

      let details = '';
      if (this.options.bothSides) {
        details = bothSidesSuccessStr || 'skipped both-sides';
      }
      this.progress.logDeletion(peerId, success, details);
    }
  }

  /**
   * Run the complete cleanup process
   */
  async run(): Promise<void> {
    try {
      this.progress.logInfo('Validating VK API access...');
      const user = await this.api.getCurrentUser();

      if (!user) {
        this.progress.logError(
          'Cannot access VK API. Valid access token is required.'
        );
        this.progress.logInfo(
          'Get your token from: https://vk.com/app51518613'
        );
        return;
      }

      this.progress.logInfo(
        `API validation successful. Logged in as: ${user.first_name} ${user.last_name} (ID: ${user.id})`
      );

      if (this.options.bothSides) {
        this.progress.logInfo('Mode: Both sides (will attempt to delete messages sent within 24 hours for everyone)');
      } else {
        this.progress.logInfo('Mode: User side only');
      }

      // Fetch all conversations
      const peerIds = await this.fetchAllConversations();

      if (peerIds.length === 0) {
        this.progress.logInfo('No conversations found to delete');
        return;
      }

      this.progress.logInfo(`Found ${peerIds.length} conversations to delete`);

      // Ask for confirmation (if not dry run)
      if (!this.options.dryRun) {
        let confirmed = false;
        if (typeof window !== 'undefined' && typeof confirm === 'function') {
          confirmed = confirm(
            `⚠️  WARNING: This will permanently delete ${peerIds.length} conversations.\n\nThis action CANNOT be undone!\n\nContinue?`
          );
        } else {
          confirmed = await this.askConfirmationNode(peerIds.length);
        }

        if (!confirmed) {
          this.progress.logInfo('Cleanup cancelled by user');
          return;
        }
      } else {
        this.progress.logWarn(
          `DRY RUN MODE - Previewing deletion for ${peerIds.length} conversations`
        );
      }

      // Delete all conversations
      await this.deleteConversations(peerIds);

      // Show completion stats
      this.progress.complete();
    } catch (error) {
      this.progress.logError('Unexpected error during cleanup', error);
    }
  }
}

/**
 * Public function to start the cleaner from DevTools console or wrapper script
 */
export async function startVKCleaner(optionsOrToken?: CleanerOptions | string): Promise<void> {
  let opts: CleanerOptions = {};
  if (typeof optionsOrToken === 'string') {
    opts = { accessToken: optionsOrToken };
  } else if (optionsOrToken) {
    opts = optionsOrToken;
  }
  const cleaner = new VKMessengerCleaner(opts);
  await cleaner.run();
}
