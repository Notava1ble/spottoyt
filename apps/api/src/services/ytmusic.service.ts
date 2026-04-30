import {
  type MatchDecision,
  matchDecisionSchema,
  mockConversionJob,
  type SpotifyTrack,
} from "@spottoyt/shared";

export class YtmusicService {
  async findMockMatches(): Promise<MatchDecision[]> {
    return matchDecisionSchema.array().parse(mockConversionJob.matches);
  }

  async findMatchesForTracks(tracks: SpotifyTrack[]): Promise<MatchDecision[]> {
    return matchDecisionSchema.array().parse(
      tracks.map((track) => ({
        trackId: track.id,
        candidate: {
          videoId: `ytm-${track.id}`,
          title: track.title,
          artists: track.artists,
          album: track.album,
          durationMs: track.durationMs,
          resultType: "song",
        },
        confidence: 0.92,
        status: "review",
      })),
    );
  }

  async createPlaylist(): Promise<{ playlistId: string; playlistUrl: string }> {
    return {
      playlistId: "ytm-demo-playlist",
      playlistUrl: "https://music.youtube.com/playlist?list=ytm-demo-playlist",
    };
  }
}
