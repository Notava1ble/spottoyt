import {
  mockConversionJob,
  type SpotifyTrack,
  spotifyTrackSchema,
} from "@spottoyt/shared";

export class SpotifyService {
  async importPlaylist(_playlistUrl: string): Promise<SpotifyTrack[]> {
    return spotifyTrackSchema.array().parse(mockConversionJob.tracks);
  }
}
