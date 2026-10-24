import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { isStaff, requireMe, sellerStatus } from "@/lib/api";

// Sends each person to the part of the panel they can use.
export default async function Dashboard() {
  const me = await requireMe();
  if (isStaff(me)) redirect("/admin");
  if ((await sellerStatus()) === "APPROVED") redirect("/seller");
  return (
    <Card title="Nothing to manage here yet">
      <p className="text-sm text-muted">
        This panel is for VoyaLive staff and authorised coin sellers. To become a seller, apply in the app: Settings → Authorised Coin Sellers.
      </p>
    </Card>
  );
}
