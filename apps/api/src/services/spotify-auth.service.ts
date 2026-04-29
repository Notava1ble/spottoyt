import { randomUUID } from "node:crypto";
import type {
  ConnectionStatus,
  SpotifyPlaylistSummary,
} from "@spottoyt/shared";

type SpotifyAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

type StoredSpotifyToken = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
};

type SpotifyTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
};

type SpotifyProfileResponse = {
  display_name?: string | null;
  id: string;
  product?: string;
};

type SpotifyPlaylistItem = {
  id: string;
  name: string;
  public: boolean | null;
  collaborative: boolean;
  owner?: {
    display_name?: string | null;
  };
  tracks: {
    total: number;
  };
  external_urls?: {
    spotify?: string;
  };
  images?: Array<{
    url?: string;
  }>;
};

type SpotifyPlaylistPage = {
  items: SpotifyPlaylistItem[];
  next: string | null;
};

export class SpotifyAuthError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
  ) {
    super(message);
  }
}

export class SpotifyAuthService {
  private readonly states = new Set<string>();
  private token?: StoredSpotifyToken;
  private displayName?: string;
  private lastError?: string;

  constructor(
    private readonly config: SpotifyAuthConfig,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  get configured() {
    return Boolean(
      this.config.clientId &&
        this.config.clientSecret &&
        this.config.redirectUri,
    );
  }

  getStatus(): ConnectionStatus {
    return {
      provider: "spotify",
      connected: Boolean(this.token),
      configured: this.configured,
      displayName: this.displayName,
      expiresAt: this.token?.expiresAt,
      error: this.lastError,
    };
  }

  getAuthorizeUrl() {
    this.requireConfigured();

    const state = randomUUID();
    this.states.add(state);

    const url = new URL("https://accounts.spotify.com/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", this.config.clientId);
    url.searchParams.set("redirect_uri", this.config.redirectUri);
    url.searchParams.set(
      "scope",
      [
        "playlist-read-private",
        "playlist-read-collaborative",
        "user-read-private",
      ].join(" "),
    );
    url.searchParams.set("state", state);

    return url.toString();
  }

  async completeCallback(code: string | undefined, state: string | undefined) {
    this.requireConfigured();

    if (!state || !this.states.has(state)) {
      throw new SpotifyAuthError("Invalid Spotify authorization state");
    }

    this.states.delete(state);

    if (!code) {
      throw new SpotifyAuthError("Missing Spotify authorization code");
    }

    const token = await this.exchangeCode(code);
    this.token = this.storeToken(token);
    const profile = await this.fetchProfile();
    this.displayName = profile.display_name ?? profile.id;
    this.lastError = undefined;
  }

  logout() {
    this.token = undefined;
    this.displayName = undefined;
    this.lastError = undefined;
  }

  async listPlaylists(): Promise<SpotifyPlaylistSummary[]> {
    if (!this.token) {
      throw new SpotifyAuthError("Spotify is not connected", 401);
    }

    const playlists: SpotifyPlaylistSummary[] = [];
    let nextUrl: string | null =
      "https://api.spotify.com/v1/me/playlists?limit=50";

    while (nextUrl) {
      const response = await this.fetcher(nextUrl, {
        headers: {
          Authorization: `Bearer ${this.token.accessToken}`,
        },
      });

      if (!response.ok) {
        await this.handleSpotifyError(response, "Unable to fetch playlists");
      }

      const page = (await response.json()) as SpotifyPlaylistPage;
      playlists.push(...page.items.map(normalizePlaylist));
      nextUrl = page.next;
    }

    this.lastError = undefined;
    return playlists;
  }

  private requireConfigured() {
    if (!this.configured) {
      throw new SpotifyAuthError("Spotify credentials are not configured", 503);
    }
  }

  private async exchangeCode(code: string): Promise<SpotifyTokenResponse> {
    const response = await this.fetcher(
      "https://accounts.spotify.com/api/token",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(
            `${this.config.clientId}:${this.config.clientSecret}`,
          )}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: this.config.redirectUri,
        }),
      },
    );

    if (!response.ok) {
      await this.handleSpotifyError(
        response,
        "Unable to exchange Spotify code",
      );
    }

    return (await response.json()) as SpotifyTokenResponse;
  }

  private storeToken(token: SpotifyTokenResponse): StoredSpotifyToken {
    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    };
  }

  private async fetchProfile(): Promise<SpotifyProfileResponse> {
    if (!this.token) {
      throw new SpotifyAuthError("Spotify is not connected", 401);
    }

    const response = await this.fetcher("https://api.spotify.com/v1/me", {
      headers: {
        Authorization: `Bearer ${this.token.accessToken}`,
      },
    });

    if (!response.ok) {
      await this.handleSpotifyError(
        response,
        "Unable to fetch Spotify profile",
      );
    }

    return (await response.json()) as SpotifyProfileResponse;
  }

  private async handleSpotifyError(
    response: Response,
    fallback: string,
  ): Promise<never> {
    const details = await response.text();
    const message = details
      ? `${fallback}: Spotify returned ${response.status} ${details}`
      : `${fallback}: Spotify returned ${response.status}`;
    this.lastError = message;
    throw new SpotifyAuthError(message, response.status === 401 ? 401 : 502);
  }
}

function normalizePlaylist(item: SpotifyPlaylistItem): SpotifyPlaylistSummary {
  return {
    id: item.id,
    name: item.name,
    trackCount: item.tracks.total,
    public: item.public,
    collaborative: item.collaborative,
    ownerName: item.owner?.display_name ?? undefined,
    externalUrl: item.external_urls?.spotify,
    imageUrl: item.images?.[0]?.url,
  };
}
