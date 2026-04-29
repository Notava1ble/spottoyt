import { Badge } from "@spottoyt/ui/components/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@spottoyt/ui/components/card";
import { conversionHistory } from "../lib/mockData";

export function HistoryPage() {
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="font-semibold text-3xl text-foreground">History</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Past conversions will become resumable once SQLite storage is wired.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {conversionHistory.map((item) => (
          <Card key={item.id}>
            <CardHeader className="flex-row items-center justify-between gap-4">
              <CardTitle>{item.name}</CardTitle>
              <Badge>
                {item.reviewed}/{item.tracks}
              </Badge>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">{item.createdAt}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
