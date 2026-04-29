import { Button } from "@spottoyt/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@spottoyt/ui/components/card";
import { Progress } from "@spottoyt/ui/components/progress";
import { CheckCircle2, CircleDotDashed } from "lucide-react";

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
              className="flex items-center justify-between rounded-lg bg-background px-4 py-3"
              key={step.label}
            >
              <span className="text-foreground">{step.label}</span>
              {step.done ? (
                <CheckCircle2 className="text-primary" aria-hidden="true" />
              ) : (
                <CircleDotDashed
                  className="text-muted-foreground"
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
