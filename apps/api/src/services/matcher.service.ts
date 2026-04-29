import type { MatchDecision } from "@spottoyt/shared";

export class MatcherService {
  summarize(matches: MatchDecision[]) {
    const accepted = matches.filter(
      (match) => match.status === "accepted",
    ).length;
    const review = matches.filter((match) => match.status === "review").length;
    const skipped = matches.filter(
      (match) => match.status === "skipped",
    ).length;

    return { accepted, review, skipped, total: matches.length };
  }
}
