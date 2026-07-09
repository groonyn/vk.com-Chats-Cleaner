/**
 * Progress UI - Console-based progress tracking for both Browser and Node.js
 */

export class ProgressUI {
  private startTime: number = 0;
  private deletedCount: number = 0;
  private totalCount: number = 0;
  private failedCount: number = 0;

  // Environment check
  private isNode: boolean =
    typeof process !== 'undefined' &&
    process.versions &&
    process.versions.node !== undefined;

  // CSS Styles for Browser Console
  private readonly styles = {
    header: 'color: #4a90e2; font-weight: bold; font-size: 14px;',
    success: 'color: #2ecc71; font-weight: bold;',
    error: 'color: #e74c3c; font-weight: bold;',
    info: 'color: #95a5a6;',
    progress: 'color: #f39c12; font-weight: bold;',
    warning: 'color: #ff9800; font-weight: bold;',
  };

  // ANSI Colors for Node.js Terminal
  private readonly colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
  };

  private print(text: string, styleKey: keyof typeof this.styles, nodeColor: string): void {
    if (this.isNode) {
      console.log(`${nodeColor}${text}${this.colors.reset}`);
    } else {
      console.log(`%c${text}`, this.styles[styleKey]);
    }
  }

  start(totalCount: number): void {
    this.startTime = Date.now();
    this.totalCount = totalCount;
    this.deletedCount = 0;
    this.failedCount = 0;

    if (this.isNode) {
      console.log('');
      this.print('🗑️  VK Messenger Chat Cleaner', 'header', this.colors.bright + this.colors.blue);
      this.print(`Starting deletion of ${totalCount} conversations...`, 'info', this.colors.cyan);
      console.log('');
    } else {
      console.clear();
      console.log('%c🗑️  VK Messenger Chat Cleaner', this.styles.header);
      console.log('%cStarting deletion of %d conversations...', this.styles.info, totalCount);
      console.log('');
    }
  }

  logDeletion(peerId: number, success: boolean, details?: string): void {
    const detailStr = details ? ` (${details})` : '';
    if (success) {
      this.deletedCount++;
      const percentage = Math.round((this.deletedCount / this.totalCount) * 100);
      const msg = `✓ [${this.deletedCount}/${this.totalCount}] ${percentage}% - Deleted conversation ${peerId}${detailStr}`;
      this.print(msg, 'success', this.colors.green);
    } else {
      this.failedCount++;
      const msg = `✗ Failed to delete conversation ${peerId}${detailStr}`;
      this.print(msg, 'error', this.colors.red);
    }
  }

  logPause(delayMs: number): void {
    if (this.deletedCount % 10 === 0 && this.deletedCount > 0) {
      const msg = `⏱️  Rate limiting... (waiting ${delayMs}ms)`;
      this.print(msg, 'info', this.colors.gray);
    }
  }

  logError(message: string, error?: any): void {
    const errStr = error ? `: ${error.message || String(error)}` : '';
    const msg = `❌ Error: ${message}${errStr}`;
    if (this.isNode) {
      console.error(`${this.colors.red}${msg}${this.colors.reset}`);
    } else {
      console.error(`%c${msg}`, this.styles.error, error || '');
    }
  }

  logInfo(message: string): void {
    const msg = `ℹ️  ${message}`;
    this.print(msg, 'info', this.colors.cyan);
  }

  logWarn(message: string): void {
    const msg = `⚠️  ${message}`;
    this.print(msg, 'warning', this.colors.yellow);
  }

  complete(): void {
    const duration = Date.now() - this.startTime;
    const durationSec = (duration / 1000).toFixed(2);

    if (this.isNode) {
      console.log('');
      console.log(`${this.colors.bright}${this.colors.blue}═══════════════════════════════════════${this.colors.reset}`);
      console.log(`${this.colors.green}${this.colors.bright}✅ Cleanup Complete!${this.colors.reset}`);
      console.log(`${this.colors.cyan}Deleted: ${this.deletedCount} conversations${this.colors.reset}`);
      console.log(
        `${this.failedCount > 0 ? this.colors.red : this.colors.cyan}Failed: ${this.failedCount} conversations${this.colors.reset}`
      );
      console.log(`${this.colors.cyan}Duration: ${durationSec} seconds${this.colors.reset}`);
      console.log(`${this.colors.bright}${this.colors.blue}═══════════════════════════════════════${this.colors.reset}`);
      console.log('');
    } else {
      console.log('');
      console.log('%c═══════════════════════════════════════', this.styles.header);
      console.log('%c✅ Cleanup Complete!', this.styles.success);
      console.log('%cDeleted: %d conversations', this.styles.info, this.deletedCount);
      console.log('%cFailed: %d conversations', this.failedCount > 0 ? this.styles.error : this.styles.info, this.failedCount);
      console.log('%cDuration: %s seconds', this.styles.info, durationSec);
      console.log('%c═══════════════════════════════════════', this.styles.header);
    }
  }

  getStats() {
    return {
      deleted: this.deletedCount,
      failed: this.failedCount,
      total: this.totalCount,
    };
  }
}
