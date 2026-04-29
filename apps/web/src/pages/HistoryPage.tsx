import { Badge } from "../components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { conversionHistory } from "../lib/mockData";

export function HistoryPage() {
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="font-semibold text-3xl text-stone-50">History</h1>
        <p className="mt-2 max-w-2xl text-stone-400">
          Past conversions will become resumable once SQLite storage is wired.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {conversionHistory.map((item) => (
          <Card key={item.id}>
            <CardHeader className="flex-row items-center justify-between gap-4">
              <CardTitle>{item.name}</CardTitle>
              <Badge tone="success">
                {item.reviewed}/{item.tracks}
              </Badge>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-stone-400">{item.createdAt}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
