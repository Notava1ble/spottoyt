import { describe, expect, it } from "bun:test";
import {
  getPlaylistIdFromUri,
  normalizePlaylistMetadata,
  normalizePlaylistContents,
  shouldShowPlaylistExtract,
} from "./playlist";

describe("Spicetify playlist helpers", () => {
  it("extracts playlist ids from context menu playlist URIs", () => {
    expect(getPlaylistIdFromUri("spotify:playlist:37i9dQZF1DXcBWIGoYBM5M")).toBe(
      "37i9dQZF1DXcBWIGoYBM5M",
    );
    expect(
      getPlaylistIdFromUri("spotify:user:alice:playlist:37i9dQZF1DWXRqgorJj26U"),
    ).toBe("37i9dQZF1DWXRqgorJj26U");
    expect(getPlaylistIdFromUri("spotify:album:2noRn2Aes5aoNVsU6iWThc")).toBeNull();
  });

  it("falls back to the selected playlist id when metadata omits the URI", () => {
    expect(
      normalizePlaylistMetadata(
        {
          name: "Road trip",
        },
        "37i9dQZF1DXcBWIGoYBM5M",
      ),
    ).toEqual({
      name: "Road trip",
      uri: "spotify:playlist:37i9dQZF1DXcBWIGoYBM5M",
    });
  });

  it("only shows extract for one playlist context menu target", () => {
    const type = {
      ALBUM: "album",
      PLAYLIST: "playlist",
      PLAYLIST_V2: "playlist-v2",
    };

    expect(
      shouldShowPlaylistExtract(["spotify:playlist:abc"], {
        fromString: () => ({ type: type.PLAYLIST }),
        type,
      }),
    ).toBe(true);
    expect(
      shouldShowPlaylistExtract(["spotify:playlist-v2:abc"], {
        fromString: () => ({ type: type.PLAYLIST_V2 }),
        type,
      }),
    ).toBe(true);
    expect(
      shouldShowPlaylistExtract(["spotify:album:def"], {
        fromString: () => ({ type: type.ALBUM }),
        type,
      }),
    ).toBe(false);
    expect(
      shouldShowPlaylistExtract(["spotify:playlist:abc", "spotify:playlist:def"], {
        fromString: () => ({ type: type.PLAYLIST }),
        type,
      }),
    ).toBe(false);
    expect(
      shouldShowPlaylistExtract(["spotify:unknown:def"], {
        fromString: () => ({ type: undefined }),
        type: { PLAYLIST: "playlist" },
      }),
    ).toBe(false);
  });

  it("normalizes Spicetify PlaylistAPI rows into import tracks", () => {
    expect(
      normalizePlaylistContents([
        {
          album: { name: "Hurry Up, We're Dreaming" },
          artists: [{ name: "M83" }],
          duration: { milliseconds: 243000 },
          isExplicit: false,
          isPlayable: true,
          metadata: {
            is_explicit: "false",
          },
          name: "Midnight City",
          type: "track",
          uri: "spotify:track:track-1",
        },
        {
          album: "Bad album shape still works",
          artists: [{ name: "" }],
          duration: 1,
          isPlayable: true,
          name: "Missing artist",
          type: "track",
          uri: "spotify:track:skip-me",
        },
      ]),
    ).toEqual([
      {
        spotifyUri: "spotify:track:track-1",
        title: "Midnight City",
        artists: ["M83"],
        album: "Hurry Up, We're Dreaming",
        durationMs: 243000,
        explicit: false,
        position: 1,
      },
    ]);
  });
});
