export type PlaylistUriApi = {
  fromString(uri: string): { type?: string };
  type: {
    PLAYLIST: string;
    PLAYLIST_V2?: string;
  };
};

export type PlaylistContentItem = {
  album?: { name?: string } | string;
  artists?: Array<{ name?: string }>;
  duration?: { milliseconds?: number } | number | string;
  duration_ms?: number;
  explicit?: boolean;
  externalIds?: {
    isrc?: string;
  };
  external_ids?: {
    isrc?: string;
  };
  isExplicit?: boolean;
  isPlayable?: boolean;
  metadata?: Record<string, string>;
  name?: string;
  type?: string;
  uri?: string;
};

export type NormalizedPlaylistTrack = {
  spotifyUri: string;
  title: string;
  artists: string[];
  album?: string;
  durationMs: number;
  isrc?: string;
  explicit: boolean;
  position: number;
};

export function getPlaylistIdFromUri(uri: string) {
  const segments = uri.split(":");
  const playlistIndex = segments.findIndex(
    (segment) => segment === "playlist" || segment === "playlist-v2",
  );

  if (playlistIndex === -1) {
    return null;
  }

  return segments[playlistIndex + 1] ?? null;
}

export function shouldShowPlaylistExtract(
  uris: string[],
  uriApi: PlaylistUriApi,
) {
  if (uris.length !== 1) {
    return false;
  }

  try {
    const uri = uris[0];
    if (!uri) {
      return false;
    }

    const uriObj = uriApi.fromString(uri);

    return (
      uriObj.type === uriApi.type.PLAYLIST ||
      (Boolean(uriApi.type.PLAYLIST_V2) &&
        uriObj.type === uriApi.type.PLAYLIST_V2)
    );
  } catch {
    return false;
  }
}

export function normalizePlaylistContents(items: PlaylistContentItem[]) {
  const tracks: NormalizedPlaylistTrack[] = [];

  for (const item of items) {
    const artists =
      item.artists
        ?.map((artist) => artist.name)
        .filter((name): name is string => Boolean(name)) ?? [];
    const durationMs = getDurationMs(item);

    if (
      item.isPlayable === false ||
      !isSpotifyTrack(item) ||
      !item.uri ||
      !item.name ||
      artists.length === 0 ||
      !durationMs
    ) {
      continue;
    }

    tracks.push({
      spotifyUri: item.uri,
      title: item.name,
      artists,
      album: getAlbumName(item),
      durationMs,
      isrc: getIsrc(item),
      explicit: getExplicit(item),
      position: tracks.length + 1,
    });
  }

  return tracks;
}

function isSpotifyTrack(item: PlaylistContentItem) {
  return item.type === undefined || item.type === "track";
}

function getAlbumName(item: PlaylistContentItem) {
  if (typeof item.album === "string") {
    return item.album;
  }

  return item.album?.name ?? item.metadata?.album_title;
}

function getDurationMs(item: PlaylistContentItem) {
  if (typeof item.duration_ms === "number") {
    return item.duration_ms;
  }

  if (typeof item.duration === "number") {
    return item.duration;
  }

  if (typeof item.duration === "string") {
    return Number(item.duration) || null;
  }

  if (typeof item.duration?.milliseconds === "number") {
    return item.duration.milliseconds;
  }

  return Number(item.metadata?.duration) || null;
}

function getExplicit(item: PlaylistContentItem) {
  return (
    item.explicit ??
    item.isExplicit ??
    item.metadata?.is_explicit === "true"
  );
}

function getIsrc(item: PlaylistContentItem) {
  return item.externalIds?.isrc ?? item.external_ids?.isrc ?? item.metadata?.isrc;
}
