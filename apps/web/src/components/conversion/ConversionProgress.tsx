import { CheckCircle2, CircleDotDashed } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Progress } from "../ui/progress";

const steps = [
  { label: "Spotify import", done: true },
  { label: "YouTube Music search", done: true },
  { label: "Review choices", done: true },
  { label: "Playlist creation", done: false },
];

export function ConversionProgress() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Playlist</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <Progress value={75} />
        <div className="grid gap-3">
          {steps.map((step) => (
            <div
              className="flex items-center justify-between rounded-md bg-stone-950 px-4 py-3"
              key={step.label}
            >
              <span className="text-stone-200">{step.label}</span>
              {step.done ? (
                <CheckCircle2
                  className="size-5 text-emerald-300"
                  aria-hidden="true"
                />
              ) : (
                <CircleDotDashed
                  className="size-5 text-amber-300"
                  aria-hidden="true"
                />
              )}
            </div>
          ))}
        </div>
        <Button>Create mock YouTube Music playlist</Button>
      </CardContent>
    </Card>
  );
}
