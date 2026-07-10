# VK Chat Cleaner

Delete all VK messenger chats instanty - tons of conversations ready.**

## Quick Start

### 1. Setup Token

**Option A: Configuration File (Recommended)**
1. Open `.env` file in this directory
2. Replace `vk1.a.YOUR_TOKEN_HERE` with your actual token
3. Save the file

**Option B: Get Token & Use CLI**
1. Open in Chrome: `https://login.vk.com/?act=web_token`
2. Copy the token (starts with `vk1.a.`)

### 2. Run Cleaner

**Terminal (with config file):**
```bash
# Test first (dry-run)
node index.js --dry-run

# Delete all chats (bilateral)
node index.js
```

**Terminal (with CLI token):**
```bash
node index.js <your-token> --dry-run
node index.js <your-token>
```

**WebStorm:** `Ctrl+Shift+F10` → Select run configuration

## Features

✅ **Configuration file** - Token stored in `.env` (not in git!)  
✅ **Bilateral deletion** - Removes chats for both you AND the other person  
✅ **Auto-retry** - Retries failed requests with exponential backoff  
✅ **Detailed logging** - Shows all API errors and retry attempts  
✅ **Smarter throttling** - 500ms delays + batches of 50  
✅ **Progress tracking** - Real-time request counter  
✅ **Stable** - Handles server rejects gracefully  

## What Happens

1. Reads token from `.env` file (or CLI/env var)
2. Validates token with your VK account
3. Fetches all conversations
4. Shows preview in dry-run mode
5. Asks confirmation (type `DELETE`)
6. Deletes all chats bilaterally (500ms each with retries)
7. Shows final stats

**Time:** ~5-10 minutes | **Mode:** Bilateral delete ✓

## Important

⚠️ **Deletion is PERMANENT** - cannot be undone!  
ℹ️ **Token Security**: `.env` is in `.gitignore` - token never commits to git  
ℹ️ **Token Expiration**: Tokens expire (~1 hour). Generate fresh token if it fails  
ℹ️ **Bilateral Mode**: May fail for chats where other users revoked permissions (handled gracefully)



