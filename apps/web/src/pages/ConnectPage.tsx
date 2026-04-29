import { Music2, Radio } from "lucide-react";
import { AccountConnectionCard } from "../components/auth/AccountConnectionCard";

export function ConnectPage() {
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="font-semibold text-3xl text-foreground">
          Connect Accounts
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Local OAuth and YouTube Music credentials will land here in the next
          integration pass.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <AccountConnectionCard
          Icon={Music2}
          name="Spotify"
          status="not-connected"
        />
        <AccountConnectionCard
          Icon={Radio}
          name="YouTube Music"
          status="not-connected"
        />
      </div>
    </section>
  );
}
