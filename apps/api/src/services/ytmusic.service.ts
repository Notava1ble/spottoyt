import {
  type MatchDecision,
  matchDecisionSchema,
  mockConversionJob,
} from "@spottoyt/shared";

export class YtmusicService {
  async findMockMatches(): Promise<MatchDecision[]> {
    return matchDecisionSchema.array().parse(mockConversionJob.matches);
  }

  async createPlaylist(): Promise<{ playlistId: string; playlistUrl: string }> {
    return {
      playlistId: "ytm-demo-playlist",
      playlistUrl: "https://music.youtube.com/playlist?list=ytm-demo-playlist",
    };
  }
}
