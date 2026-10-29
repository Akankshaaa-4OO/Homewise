"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function HouseholdStatus({ onHouseholdReady }: { onHouseholdReady?: (householdId: string, userId: string) => void }) {
  const [status, setStatus] = useState<"loading" | "ready" | "create" | "invitation" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const supabase = createSupabaseBrowserClient();

    async function loadHousehold() {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        if (active) setStatus("create");
        return;
      }

      const { data, error } = await supabase
        .from("household_members")
        .select("household_id, households(name)")
        .eq("user_id", userData.user.id)
        .limit(1)
        .maybeSingle();

      if (!active) return;
      if (error) {
        setStatus("error");
        setMessage(error.message);
      } else if (data) {
        setStatus("ready");
        onHouseholdReady?.(data.household_id, userData.user.id);
        setMessage(Array.isArray(data.households) ? data.households[0]?.name ?? "Household connected" : "Household connected");
      } else {
        const { data: invitationHouseholdId } = await supabase.rpc("accept_household_invitation");
        if (invitationHouseholdId) {
          setStatus("ready");
          onHouseholdReady?.(invitationHouseholdId, userData.user.id);
          setMessage("Invitation accepted");
        } else {
          setStatus("create");
        }
      }
    }

    void loadHousehold();
    return () => {
      active = false;
    };
  }, [onHouseholdReady]);

  async function createHousehold() {
    setStatus("loading");
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("create_household", { household_name: "My Homewise household" });
    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("ready");
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) onHouseholdReady?.(data, userData.user.id);
    setMessage(`Connected household: ${data}`);
  }

  async function acceptInvitation() {
    setStatus("loading");
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("accept_household_invitation");
    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }
    setStatus("ready");
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) onHouseholdReady?.(data, userData.user.id);
    setMessage(`Invitation accepted: ${data}`);
  }

  if (status === "loading") return <p className="text-xs text-slate-400">Checking household connection...</p>;
  if (status === "ready") return <p className="text-xs text-emerald-700">● {message}</p>;
  if (status === "error") return <p className="max-w-xs text-xs text-rose-600">Database connection needs attention: {message}</p>;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="text-xs text-amber-700">Your account is not in a household yet.</p>
      <button onClick={acceptInvitation} className="rounded-lg bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-800 hover:bg-violet-200">Accept invitation</button>
      <button onClick={createHousehold} className="rounded-lg bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-200">Create one</button>
    </div>
  );
}
