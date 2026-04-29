import { Badge } from "@spottoyt/ui/components/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@spottoyt/ui/components/card";

const settings = [
  ["Spicetify API target", "http://127.0.0.1:4317/imports/spicetify"],
  ["Spicetify events", "http://127.0.0.1:4317/events"],
  ["SQLite database", "./data/spottoyt.sqlite"],
  ["YouTube Music auth", "./auth/ytmusic-oauth.json"],
];

export function SettingsPage() {
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="font-semibold text-3xl text-foreground">Settings</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Local paths and callback URLs stay explicit so credentials are easy to
          audit.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Local configuration</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex flex-col gap-2 rounded-lg bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-muted-foreground text-sm">
                Spotify import
              </span>
              <p className="font-medium text-foreground">Spicetify bridge</p>
            </div>
            <Badge variant="secondary">Web API deprecated</Badge>
          </div>
          {settings.map(([label, value]) => (
            <div
              className="grid gap-1 rounded-lg bg-background px-4 py-3"
              key={label}
            >
              <span className="text-muted-foreground text-sm">{label}</span>
              <code className="break-all text-primary text-sm">{value}</code>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
