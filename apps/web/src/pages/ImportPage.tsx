import { PlaylistImportPanel } from "../components/conversion/PlaylistImportPanel";

export function ImportPage() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-semibold text-3xl text-stone-50">
          Import Playlist
        </h1>
        <p className="mt-2 max-w-2xl text-stone-400">
          The first real version will read Spotify tracks into the local
          conversion database.
        </p>
      </div>
      <PlaylistImportPanel />
    </section>
  );
}
