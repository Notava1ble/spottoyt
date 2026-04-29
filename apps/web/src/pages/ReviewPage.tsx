import { MatchReviewTable } from "../components/conversion/MatchReviewTable";

export function ReviewPage() {
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="font-semibold text-3xl text-foreground">
          Matching Review
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          High-confidence songs can be accepted automatically; uncertain matches
          stay visible.
        </p>
      </div>
      <MatchReviewTable />
    </section>
  );
}
