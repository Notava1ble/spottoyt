import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";

const settings = [
  ["Spotify redirect", "http://127.0.0.1:4317/auth/spotify/callback"],
  ["SQLite database", "./data/spottoyt.sqlite"],
  ["YouTube Music auth", "./auth/ytmusic-oauth.json"],
];

export function SettingsPage() {
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="font-semibold text-3xl text-stone-50">Settings</h1>
        <p className="mt-2 max-w-2xl text-stone-400">
          Local paths and callback URLs stay explicit so credentials are easy to
          audit.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Local configuration</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {settings.map(([label, value]) => (
            <div
              className="grid gap-1 rounded-md bg-stone-950 px-4 py-3"
              key={label}
            >
              <span className="text-sm text-stone-500">{label}</span>
              <code className="break-all text-emerald-200 text-sm">
                {value}
              </code>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
