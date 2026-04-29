import { ConversionProgress } from "../components/conversion/ConversionProgress";

export function CreatePage() {
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="font-semibold text-3xl text-stone-50">
          Create Playlist
        </h1>
        <p className="mt-2 max-w-2xl text-stone-400">
          The real YouTube Music writer will run after review decisions are
          locked.
        </p>
      </div>
      <ConversionProgress />
    </section>
  );
}
