/**
 * VK API Client - Wrapper for VK REST API endpoints
 * Now requires an access token due to VK API security updates
 */

const VK_API_URL = 'https://api.vk.com/method';
const API_VERSION = '5.282';

export interface VKApiResponse<T> {
  response?: T;
  error?: {
    error_code: number;
    error_msg: string;
  };
}

export interface VKConversation {
  conversation: {
    peer: {
      id: number;
      type: string;
    };
    in_read: number;
    out_read: number;
  };
  last_message: {
    id: number;
    date: number;
    from_id: number;
    peer_id: number;
    text: string;
  };
}

export interface VKConversationsResponse {
  count: number;
  unread_count: number;
  items: VKConversation[];
}

export interface VKMessage {
  id: number;
  date: number;
  from_id: number;
  peer_id: number;
  text: string;
}

export interface VKHistoryResponse {
  count: number;
  items: VKMessage[];
}

export interface VKUser {
  id: number;
  first_name: string;
  last_name: string;
}

export class VKApi {
  private accessToken: string = '';
  private cachedCurrentUser: VKUser | null = null;
  private lastRequestTime: number = 0;
  private readonly minDelayMs: number = 350; // Minimum delay between request starts to respect 3 req/sec rate limit

  constructor(accessToken?: string) {
    this.accessToken = accessToken || '';
    if (!this.accessToken) {
      this.extractAccessToken();
    }
  }

  /**
   * Try to extract access token from environment, configuration file, or storage
   */
  private extractAccessToken(): void {
    // 1. Check Node.js process environment
    if (typeof process !== 'undefined' && process.env && process.env.VK_TOKEN) {
      this.accessToken = process.env.VK_TOKEN;
      return;
    }

    // 2. Try to read .env file in Node.js
    if (typeof require !== 'undefined' && typeof process !== 'undefined') {
      try {
        const fs = require('fs');
        const path = require('path');
        const envPath = path.join(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
          const content = fs.readFileSync(envPath, 'utf8');
          const lines = content.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
              const [key, ...valueParts] = trimmed.split('=');
              if (key && key.trim() === 'VK_TOKEN') {
                this.accessToken = valueParts.join('=').trim();
                return;
              }
            }
          }
        }
      } catch (e) {
        // Ignore filesystem errors in non-node environments
      }
    }

    // 3. Check browser localStorage
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('vk_access_token');
      if (stored) {
        this.accessToken = stored;
        return;
      }
    }

    // 4. Check browser sessionStorage
    if (typeof sessionStorage !== 'undefined') {
      const session = sessionStorage.getItem('vk_token');
      if (session) {
        this.accessToken = session;
        return;
      }
    }
  }

  /**
   * Rate limiting throttle helper
   */
  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minDelayMs) {
      const waitTime = this.minDelayMs - elapsed;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Make a request to VK API with throttling and auto-retry logic for rate limits
   */
  private async makeRequest<T>(
    method: string,
    params: Record<string, any>,
    retries: number = 5
  ): Promise<VKApiResponse<T>> {
    if (!this.accessToken) {
      return {
        error: {
          error_code: 15,
          error_msg: 'Access token required. Get one from https://vk.com/app51518613',
        },
      };
    }

    await this.throttle();

    const url = new URL(`${VK_API_URL}/${method}`);
    url.searchParams.append('access_token', this.accessToken);
    url.searchParams.append('v', API_VERSION);
    url.searchParams.append('lang', 'en');

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      // Handle Rate Limit (code 6) or Flood Control (code 9) with retry logic
      if (data.error && (data.error.error_code === 6 || data.error.error_code === 9) && retries > 0) {
        const isFlood = data.error.error_code === 9;
        const baseWaitTime = isFlood ? 3000 : 1000;
        let waitTime = baseWaitTime * (6 - retries); // For flood control: 3s, 6s, 9s, 12s, 15s. For error 6: 1s, 2s, 3s, 4s, 5s.
        if (isFlood) {
          waitTime = Math.min(waitTime, 9000); // Cap flood control retry delay at 9 seconds
        }
        console.warn(`[VK API] ${isFlood ? 'Flood control (Error 9)' : 'Rate limit (Error 6)'} hit on ${method}. Retrying in ${waitTime}ms... (${retries} attempts remaining)`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.makeRequest<T>(method, params, retries - 1);
      }

      return data;
    } catch (error) {
      return {
        error: {
          error_code: -1,
          error_msg: String(error),
        },
      };
    }
  }

  /**
   * Get all conversations for the user
   */
  async getConversations(offset: number = 0, count: number = 200): Promise<VKConversationsResponse | null> {
    const result = await this.makeRequest<VKConversationsResponse>('messages.getConversations', {
      offset,
      count,
      extended: 0,
    });

    if (result.error) {
      console.error(`VK API Error: ${result.error.error_msg} (${result.error.error_code})`);
      return null;
    }

    return result.response || null;
  }

  /**
   * Delete a conversation (only for user side)
   */
  async deleteConversation(peerId: number): Promise<boolean> {
    const result = await this.makeRequest<number>('messages.deleteConversation', {
      peer_id: peerId,
    });

    if (result.error) {
      if (result.error.error_code !== 6 && result.error.error_code !== 9) {
        console.warn(`Failed to delete conversation ${peerId}: ${result.error.error_msg}`);
      }
      return false;
    }

    return true;
  }

  /**
   * Get history of a conversation
   */
  async getHistory(peerId: number, offset: number = 0, count: number = 200): Promise<VKHistoryResponse | null> {
    const result = await this.makeRequest<VKHistoryResponse>('messages.getHistory', {
      peer_id: peerId,
      offset,
      count,
    });

    if (result.error) {
      console.error(`Failed to get history for conversation ${peerId}: ${result.error.error_msg}`);
      return null;
    }

    return result.response || null;
  }

  /**
   * Delete specific messages (optionally delete for all participants)
   */
  async deleteMessages(messageIds: number[], deleteForAll: boolean = false): Promise<boolean> {
    if (messageIds.length === 0) return true;

    const result = await this.makeRequest<Record<string, number>>('messages.delete', {
      message_ids: messageIds.join(','),
      delete_for_all: deleteForAll ? 1 : 0,
    });

    if (result.error) {
      console.error(`Failed to delete messages [${messageIds.join(',')}]: ${result.error.error_msg}`);
      return false;
    }

    return true;
  }

  /**
   * Get details of the currently authenticated user
   */
  async getCurrentUser(): Promise<VKUser | null> {
    if (this.cachedCurrentUser) {
      return this.cachedCurrentUser;
    }

    const result = await this.makeRequest<VKUser[]>('users.get', {
      fields: 'id,first_name,last_name',
    });

    if (result.error || !result.response || result.response.length === 0) {
      console.error(`Failed to retrieve current user info: ${result?.error?.error_msg || 'unknown error'}`);
      return null;
    }

    this.cachedCurrentUser = result.response[0];
    return this.cachedCurrentUser;
  }

  /**
   * Validate that API is accessible and user is authenticated
   */
  async validateAccess(): Promise<boolean> {
    const user = await this.getCurrentUser();
    return !!user;
  }
}
