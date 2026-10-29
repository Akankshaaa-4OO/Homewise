"use client";

import { FormEvent, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Member = { user_id: string; display_name: string; role: string };

const starterCategories = ["Groceries", "Transport", "Utilities", "Education", "Shopping", "Subscriptions", "Other"];

export default function HouseholdSettings({ householdId, currentUserId, onCategoriesChange }: { householdId: string | null; currentUserId: string | null; onCategoriesChange: (categories: string[]) => void }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [categories, setCategories] = useState(starterCategories);
  const [newCategory, setNewCategory] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!householdId) return;
    const supabase = createSupabaseBrowserClient();
    void Promise.all([
      supabase.from("household_members").select("user_id, display_name, role").eq("household_id", householdId),
      supabase.from("household_categories").select("name").eq("household_id", householdId).order("name"),
    ]).then(([memberResult, categoryResult]) => {
      if (memberResult.data) setMembers(memberResult.data);
      if (categoryResult.data?.length) {
        const loadedCategories = categoryResult.data.map((category) => category.name);
        setCategories(loadedCategories);
        onCategoriesChange(loadedCategories);
      }
      if (memberResult.error || categoryResult.error) setMessage(memberResult.error?.message ?? categoryResult.error?.message ?? "");
    });
  }, [householdId, onCategoriesChange]);

  async function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!householdId || !inviteEmail || !inviteName) return;
    const { error } = await createSupabaseBrowserClient().from("household_invitations").insert({
      household_id: householdId, email: inviteEmail.trim().toLowerCase(), display_name: inviteName.trim(), role: "member",
    });
    setMessage(error ? error.message : "Invitation saved. The person can join after signing in with that email.");
    if (!error) { setInviteEmail(""); setInviteName(""); }
  }

  async function renameSelf() {
    if (!householdId || !currentUserId) return;
    const name = window.prompt("What name should Homewise show for you?");
    if (!name?.trim()) return;
    const { error } = await createSupabaseBrowserClient().from("household_members").update({ display_name: name.trim() }).eq("household_id", householdId).eq("user_id", currentUserId);
    setMessage(error ? error.message : "Your member name was updated.");
    if (!error) setMembers((current) => current.map((member) => member.user_id === currentUserId ? { ...member, display_name: name.trim() } : member));
  }

  async function leaveHousehold() {
    if (!householdId || !window.confirm("Leave this household? Your transactions will remain owned by your account.")) return;
    const { error } = await createSupabaseBrowserClient().rpc("remove_self_from_household", { target_household_id: householdId });
    setMessage(error ? error.message : "You left the household.");
    if (!error) setMembers((current) => current.filter((member) => member.user_id !== currentUserId));
  }

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!householdId || !newCategory.trim()) return;
    const name = newCategory.trim();
    const { error } = await createSupabaseBrowserClient().from("household_categories").insert({ household_id: householdId, name, created_by: currentUserId });
    setMessage(error ? error.message : "Category added.");
    if (!error) {
      const nextCategories = [...categories, name].sort();
      setCategories(nextCategories);
      onCategoriesChange(nextCategories);
      setNewCategory("");
    }
  }

  async function renameCategory(oldName: string) {
    if (!householdId) return;
    const name = window.prompt("Rename category", oldName)?.trim();
    if (!name || name === oldName) return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("household_categories").update({ name }).eq("household_id", householdId).eq("name", oldName);
    setMessage(error ? error.message : "Category renamed.");
    if (!error) {
      const nextCategories = categories.map((category) => category === oldName ? name : category).sort();
      setCategories(nextCategories);
      onCategoriesChange(nextCategories);
    }
  }

  async function deleteCategory(name: string) {
    if (!householdId || !window.confirm(`Delete "${name}" from category choices? Existing transactions keep their recorded name.`)) return;
    const { error } = await createSupabaseBrowserClient().from("household_categories").delete().eq("household_id", householdId).eq("name", name);
    setMessage(error ? error.message : "Category deleted.");
    if (!error) {
      const nextCategories = categories.filter((category) => category !== name);
      setCategories(nextCategories);
      onCategoriesChange(nextCategories);
    }
  }

  if (!householdId) {
    return (
      <section className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-6" id="settings">
        <h2 className="font-bold text-amber-900">Household settings</h2>
        <p className="mt-1 text-sm text-amber-800">Sign in and connect a household above to manage people and categories.</p>
      </section>
    );
  }

  return (
    <section className="mb-8 grid gap-6 xl:grid-cols-2" id="settings">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-bold">Household people</h2>
        <p className="mt-1 text-xs text-slate-400">Invite someone by email, or manage your own profile.</p>
        <form onSubmit={inviteMember} className="mt-5 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input required type="text" value={inviteName} onChange={(event) => setInviteName(event.target.value)} placeholder="Person&apos;s name" aria-label="Person name" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <input required type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="Email address" aria-label="Person email" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <button className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Invite</button>
        </form>
        <div className="mt-5 space-y-2">
          {members.map((member) => <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2" key={member.user_id}><span className="text-sm font-medium">{member.display_name} <span className="text-xs text-slate-400">({member.role})</span></span>{member.user_id === currentUserId && <span className="flex gap-2"><button onClick={renameSelf} className="text-xs font-semibold text-emerald-700">Rename</button><button onClick={leaveHousehold} className="text-xs font-semibold text-rose-600">Leave</button></span>}</div>)}
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-bold">Categories</h2>
        <p className="mt-1 text-xs text-slate-400">Add a custom category for spending that does not fit the defaults.</p>
        <form onSubmit={addCategory} className="mt-5 flex gap-2">
          <input required value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="e.g. Pet care" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <button className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Add</button>
        </form>
        <div className="mt-5 flex flex-wrap gap-2">{categories.map((category) => <span className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-600" key={category}>{category}<button onClick={() => renameCategory(category)} aria-label={`Rename ${category}`}>✎</button><button onClick={() => deleteCategory(category)} aria-label={`Delete ${category}`} className="text-rose-500">×</button></span>)}</div>
      </div>
      {message && <p className="text-xs text-slate-500 xl:col-span-2">{message}</p>}
    </section>
  );
}
