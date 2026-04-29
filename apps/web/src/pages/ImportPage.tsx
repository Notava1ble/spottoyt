import { PlaylistImportPanel } from "../components/conversion/PlaylistImportPanel";

export function ImportPage() {
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="font-semibold text-3xl text-foreground">
          Import Playlist
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          The first real version will read Spotify tracks into the local
          conversion database.
        </p>
      </div>
      <PlaylistImportPanel />
    </section>
  );
}
