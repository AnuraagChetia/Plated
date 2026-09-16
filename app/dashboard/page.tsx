import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import Dashboard from "./dashboard";

export default async function DashboardPage() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/sign-in");
  const { data: restaurant, error } = await client.from("restaurants").select("id")
    .eq("owner_id",user.id).order("created_at").limit(1).maybeSingle();
  if (error) throw new Error("Could not load your restaurant.");
  if (!restaurant) redirect("/onboarding");
  return <Dashboard ownerName={user.user_metadata.name || "there"} />;
}
