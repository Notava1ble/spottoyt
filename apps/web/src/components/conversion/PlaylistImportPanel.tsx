import { ListMusic, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { shellConversion } from "../../lib/mockData";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

export function PlaylistImportPanel() {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card>
        <CardHeader>
          <CardTitle>Spotify Playlist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-stone-300">
              Playlist URL
            </span>
            <input
              className="h-11 w-full rounded-md border border-stone-700 bg-stone-950 px-3 text-stone-100 outline-none focus:border-emerald-400"
              defaultValue="https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"
            />
          </label>
          <Button asChild>
            <Link to="/review">
              <Search className="h-4 w-4" aria-hidden="true" />
              Import mock playlist
            </Link>
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-emerald-400 text-stone-950">
              <ListMusic className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="font-medium text-stone-100">
                {shellConversion.sourcePlaylistName}
              </p>
              <p className="text-sm text-stone-400">
                {shellConversion.tracks.length} demo tracks
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
