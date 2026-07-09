#!/usr/bin/env node

/**
 * VK Chat Cleaner - Node.js Runner
 * Uses the unified compiled TypeScript modules from dist/
 */

const { startVKCleaner } = require('./dist/cleaner');

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  const dryRun = args.includes('--dry-run');
  const bothSides = args.includes('--both-sides');
  
  // Extract token if passed as a positional argument (not starting with --)
  const tokenArg = args.find(arg => !arg.startsWith('--'));

  try {
    await startVKCleaner({
      accessToken: tokenArg, // Will fall back to process.env.VK_TOKEN or .env in VKApi
      dryRun: dryRun,
      bothSides: bothSides
    });
  } catch (error) {
    console.error(`\x1b[31mFatal error: ${error.message || error}\x1b[0m`);
    process.exit(1);
  }
}

main();
