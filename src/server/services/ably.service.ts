import Ably from "ably";

/**
 * Ably Authentication Service
 * Handles token generation for client-side real-time connections
 *
 * @see docs/plans/plan_ably_integration.md
 * @see docs/api.md Section 10
 */

// Error types for proper error handling
export class AblyConfigurationError extends Error {
  constructor() {
    super("ABLY_API_KEY environment variable is not set");
    this.name = "AblyConfigurationError";
  }
}

export class AblyTokenGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AblyTokenGenerationError";
  }
}

// Singleton REST client for auth operations
let ablyAuthClient: Ably.Rest | null = null;

function getAblyAuthClient(): Ably.Rest {
  if (!ablyAuthClient) {
    const apiKey = process.env.ABLY_API_KEY;
    if (!apiKey) {
      throw new AblyConfigurationError();
    }
    ablyAuthClient = new Ably.Rest(apiKey);
  }
  return ablyAuthClient;
}

export const ablyService = {
  /**
   * Check if Ably is configured
   */
  isConfigured(): boolean {
    return !!process.env.ABLY_API_KEY;
  },

  /**
   * Generate a TokenRequest for a user
   * The TokenRequest is used by clients to authenticate with Ably
   *
   * @param userId - The authenticated user's ID
   * @returns Ably TokenRequest data
   */
  async createTokenRequest(userId: string): Promise<Ably.TokenRequest> {
    const client = getAblyAuthClient();

    const tokenRequest = await client.auth.createTokenRequest({
      clientId: userId,
      // Define capabilities to restrict access to user's channels
      capability: {
        // User's private channels
        [`user:${userId}:*`]: ["subscribe", "presence"],
        // Conversation channels (user can subscribe to any conversation they're part of)
        ["conversation:*"]: ["subscribe", "presence"],
        // Public listing bid channels
        ["listing:*:bids"]: ["subscribe"],
        // Order status channels
        ["order:*:status"]: ["subscribe"],
      },
    });

    return tokenRequest;
  },
};
