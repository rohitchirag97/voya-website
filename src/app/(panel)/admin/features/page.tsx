import { redirect } from "next/navigation";
import { button, Card, Flash, ghost } from "@/components/ui";
import { api, can, requireMe } from "@/lib/api";
import { setGamesSwitch } from "../../../actions";

// Feature switches: features that ship hidden and are turned on here when the time comes. Needs the Feature switches
// switch (the owner has it).
export default async function Features({ searchParams }: PageProps<"/admin/features">) {
  const me = await requireMe();
  if (!can(me, "features.manage")) redirect("/dashboard");
  const sp = await searchParams;
  const { games } = await api<{ games: boolean }>("GET", "/admin/features");

  return (
    <>
      <div>
        <h1 className="text-2xl font-extrabold">Feature switches</h1>
        <p className="mt-1 text-sm text-muted">Turn features on or off for everyone. A change reaches open apps right away.</p>
      </div>
      <Flash ok={sp.ok} error={sp.error} />

      <Card title="Games" hint="Greedy Jungle, Greedy Galaxy, Rocket, Lucky Slots and Roulette, all together.">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-semibold">
              Status:{" "}
              <span className={games ? "text-success" : "text-muted"}>{games ? "On" : "Off"}</span>
            </p>
            <p className="mt-1 text-sm text-muted">
              {games
                ? "Everyone sees the Games button in rooms and can bet."
                : "The Games button, game tiles and Play links are hidden, and the server refuses bets. Bets already placed in a running round still pay out."}
            </p>
          </div>
          <form action={setGamesSwitch}>
            <input type="hidden" name="enabled" value={games ? "false" : "true"} />
            <button className={games ? ghost : button}>{games ? "Turn games off" : "Turn games on"}</button>
          </form>
        </div>
      </Card>
    </>
  );
}
