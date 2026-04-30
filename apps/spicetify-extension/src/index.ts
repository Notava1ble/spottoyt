import {
  getPlaylistIdFromUri,
  normalizePlaylistMetadata,
  normalizePlaylistContents,
  type PlaylistContentItem,
  shouldShowPlaylistExtract,
} from "./playlist";

const DEFAULT_API_URL = "http://127.0.0.1:4317";
const API_URL_STORAGE_KEY = "spottoyt-api-url";

type SpotifyPlaylistResponse = {
  name?: string;
  uri?: string;
};

type SpicetifySnapshot = {
  source: "spicetify";
  spotifyPlaylistUri: string;
  playlistName: string;
  snapshotAt: string;
  tracks: Array<{
    spotifyUri: string;
    title: string;
    artists: string[];
    album?: string;
    durationMs: number;
    isrc?: string;
    explicit: boolean;
    position: number;
  }>;
};

void boot();

async function boot() {
  if (!isReady()) {
    window.setTimeout(() => {
      void boot();
    }, 300);
    return;
  }

  registerPlaylistContextMenu();
  notify("SpottoYT bridge ready");
}

function isReady() {
  return Boolean(
    Spicetify.ContextMenu &&
      Spicetify.CosmosAsync &&
      Spicetify.Platform?.PlaylistAPI &&
      Spicetify.URI,
  );
}

function registerPlaylistContextMenu() {
  const contextMenu = Spicetify.ContextMenu;
  const uri = Spicetify.URI;

  if (!contextMenu || !uri) {
    return;
  }

  const uriApi = {
    fromString: uri.fromString,
    type: uri.Type,
  };

  new contextMenu.Item(
    "Extract to SpottoYT",
    async (uris) => {
      const playlistId = getPlaylistIdFromUri(uris[0] ?? "");

      if (!playlistId) {
        notify("Choose a Spotify playlist first", true);
        return;
      }

      await sendPlaylist(playlistId);
    },
    (uris) => shouldShowPlaylistExtract(uris, uriApi),
    "download",
  ).register();
}

async function sendPlaylist(playlistId: string) {
  try {
    const snapshot = await readPlaylistSnapshot(playlistId);

    if (snapshot.tracks.length === 0) {
      notify("No Spotify tracks found in this playlist", true);
      return;
    }

    await postSnapshot(snapshot);
    notify(`Sent ${snapshot.tracks.length} tracks to SpottoYT`);
  } catch (error) {
    notify(
      error instanceof Error ? error.message : "SpottoYT sync failed",
      true,
    );
  }
}

async function readPlaylistSnapshot(
  playlistId: string,
): Promise<SpicetifySnapshot> {
  const cosmos = getCosmos();
  const playlist = await cosmos.get<SpotifyPlaylistResponse>(
    `https://api.spotify.com/v1/playlists/${playlistId}?fields=name,uri`,
  );
  const metadata = normalizePlaylistMetadata(playlist, playlistId);

  return {
    source: "spicetify",
    spotifyPlaylistUri: metadata.uri,
    playlistName: metadata.name,
    snapshotAt: new Date().toISOString(),
    tracks: await readPlaylistTracks(playlistId),
  };
}

async function readPlaylistTracks(playlistId: string) {
  const page = await getPlaylistApi().getContents(
    `spotify:playlist:${playlistId}`,
    { limit: 9999999 },
  );

  if (!Array.isArray(page.items)) {
    throw new Error("Spicetify returned playlist contents without tracks");
  }

  return normalizePlaylistContents(page.items as PlaylistContentItem[]);
}

function getCosmos() {
  const cosmos = Spicetify.CosmosAsync;

  if (!cosmos) {
    throw new Error("Spicetify Cosmos is not ready");
  }

  return cosmos;
}

function getPlaylistApi() {
  const playlistApi = Spicetify.Platform?.PlaylistAPI;

  if (!playlistApi) {
    throw new Error("Spicetify Playlist API is not ready");
  }

  return playlistApi;
}

async function postSnapshot(snapshot: SpicetifySnapshot) {
  const response = await fetch(`${getApiUrl()}/imports/spicetify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(snapshot),
  });

  if (!response.ok) {
    throw new Error(`SpottoYT rejected the import: ${response.status}`);
  }
}

function getApiUrl() {
  return (
    Spicetify.LocalStorage?.get(API_URL_STORAGE_KEY)?.replace(/\/$/, "") ??
    DEFAULT_API_URL
  );
}

function notify(message: string, isError = false) {
  Spicetify.showNotification?.(message, isError, 4000);
  console.log(`[SpottoYT] ${message}`);
}
