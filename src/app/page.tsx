 "use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import AuthButton from "./auth-button";
import HouseholdStatus from "./household-status";
import HouseholdSettings from "./household-settings";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type TransactionType = "income" | "expense" | "transfer";
type TransactionScope = "shared" | "personal";

type Transaction = {
  id?: string;
  title: string;
  person: string;
  category: string;
  amount: number;
  date: string;
  type: TransactionType;
  scope: TransactionScope;
  initials: string;
};

const members = [
  { name: "Dad", role: "Parent", initials: "D", color: "bg-blue-100 text-blue-700" },
  { name: "Mum", role: "Parent", initials: "M", color: "bg-rose-100 text-rose-700" },
  { name: "Anika", role: "Student", initials: "A", color: "bg-violet-100 text-violet-700" },
  { name: "Rohan", role: "Sibling", initials: "R", color: "bg-amber-100 text-amber-700" },
];

const defaultCategories = ["Groceries", "Transport", "Utilities", "Education", "Shopping", "Subscriptions", "Other"];

const formatInr = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

const transactions: Transaction[] = [
  {
    title: "Salary",
    person: "Dad",
    category: "Income",
    amount: 65000,
    date: "Today",
    type: "income",
    scope: "shared",
    initials: "D",
  },
  {
    title: "Groceries",
    person: "Mum",
    category: "Shared",
    amount: -4250,
    date: "Yesterday",
    type: "expense",
    scope: "shared",
    initials: "M",
  },
  {
    title: "College fees",
    person: "Anika",
    category: "Education",
    amount: -12000,
    date: "24 Oct",
    type: "expense",
    scope: "personal",
    initials: "A",
  },
  {
    title: "Pocket money",
    person: "Dad to Anika",
    category: "Transfer",
    amount: 3000,
    date: "22 Oct",
    type: "transfer",
    scope: "personal",
    initials: "A",
  },
];

const categorySpending = [
  { label: "Groceries", amount: 12500, width: "82%", color: "bg-emerald-500" },
  { label: "Education", amount: 12000, width: "68%", color: "bg-violet-500" },
  { label: "Utilities", amount: 7800, width: "45%", color: "bg-amber-400" },
  { label: "Transport", amount: 5400, width: "32%", color: "bg-sky-400" },
];

const upcomingBills = [
  { name: "Electricity bill", date: "Due in 3 days", dueDate: "1 Nov", amount: 2450, color: "bg-amber-100 text-amber-700" },
  { name: "Home internet", date: "Due in 8 days", dueDate: "6 Nov", amount: 999, color: "bg-sky-100 text-sky-700" },
  { name: "Netflix", date: "Due in 14 days", dueDate: "12 Nov", amount: 649, color: "bg-rose-100 text-rose-700" },
];

const budgetPlans = [
  { label: "Groceries", spent: 12500, limit: 15000, color: "bg-emerald-500" },
  { label: "Transport", spent: 5400, limit: 8000, color: "bg-sky-400" },
  { label: "Education", spent: 12000, limit: 15000, color: "bg-violet-500" },
];

const monthlyFlow = [
  { month: "Jun", income: 62, spending: 41 },
  { month: "Jul", income: 70, spending: 45 },
  { month: "Aug", income: 67, spending: 39 },
  { month: "Sep", income: 74, spending: 52 },
  { month: "Oct", income: 72, spending: 30 },
];

export default function Home() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<TransactionType>("expense");
  const [transactionList, setTransactionList] = useState(transactions);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [categoryOptions, setCategoryOptions] = useState(defaultCategories);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [databaseMessage, setDatabaseMessage] = useState("");
  const [isDatabaseLoading, setIsDatabaseLoading] = useState(true);
  const handleHouseholdReady = useCallback((id: string, signedInUserId: string) => {
    setHouseholdId(id);
    setUserId(signedInUserId);
  }, []);

  const visibleTransactions = transactionList
    .map((transaction, index) => ({ transaction, index }))
    .filter(({ transaction }) => {
      const search = searchText.toLowerCase();
      const matchesSearch = [transaction.title, transaction.person, transaction.category].some((value) => value.toLowerCase().includes(search));
      const matchesType = typeFilter === "all" || transaction.type === typeFilter;
      const matchesScope = scopeFilter === "all" || transaction.scope === scopeFilter;
      return matchesSearch && matchesType && matchesScope;
    });

  const editingTransaction = editingIndex === null ? null : transactionList[editingIndex];

  useEffect(() => {
    let active = true;
    const supabase = createSupabaseBrowserClient();

    async function loadSavedTransactions() {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        if (active) setIsDatabaseLoading(false);
        return;
      }

      const { data: membership, error: membershipError } = await supabase
        .from("household_members")
        .select("household_id")
        .eq("user_id", userData.user.id)
        .limit(1)
        .maybeSingle();
      if (membershipError || !membership) {
        if (active) {
          setDatabaseMessage(membershipError?.message ?? "Create a household to save transactions.");
          setIsDatabaseLoading(false);
        }
        return;
      }

      const { data: savedTransactions, error: transactionError } = await supabase
        .from("transactions")
        .select("id, description, amount_paise, transaction_type, category, occurred_on, scope")
        .eq("household_id", membership.household_id)
        .order("occurred_on", { ascending: false });
      if (transactionError) {
        if (active) {
          setDatabaseMessage(transactionError.message);
          setIsDatabaseLoading(false);
        }
        return;
      }

      if (active) {
        setHouseholdId(membership.household_id);
        setUserId(userData.user.id);
        setTransactionList(savedTransactions.map((transaction) => ({
          title: transaction.description,
          person: "You",
          category: transaction.category,
          amount: transaction.transaction_type === "expense" ? -Number(transaction.amount_paise) / 100 : Number(transaction.amount_paise) / 100,
          date: transaction.occurred_on,
          type: transaction.transaction_type as TransactionType,
          scope: transaction.scope as TransactionScope,
          initials: "Y",
          id: transaction.id,
        })));
        setIsDatabaseLoading(false);
      }
    }

    void loadSavedTransactions();
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        void loadSavedTransactions();
      }
    });
    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  function openAddForm() {
    setEditingIndex(null);
    setTransactionType("expense");
    setIsFormOpen(true);
  }

  function openEditForm(index: number) {
    const transaction = transactionList[index];
    setEditingIndex(index);
    setTransactionType(transaction.type);
    setIsFormOpen(true);
  }

  async function addTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const amount = Number(formData.get("amount"));
    const title = String(formData.get("description"));
    const person = String(formData.get("person"));
    const category = String(formData.get("category"));
    const scope = formData.get("scope") as TransactionScope;
    const date = String(formData.get("date"));

    if (!title || !person || !amount || amount <= 0) {
      return;
    }

    if (householdId && userId) {
      if (transactionType === "transfer") {
        setDatabaseMessage("Transfers need sender and recipient member IDs before they can be saved safely.");
        return;
      }
      const supabase = createSupabaseBrowserClient();
      const transactionData = {
        household_id: householdId,
        owner_user_id: userId,
        created_by_user_id: userId,
        description: title,
        amount_paise: Math.round(amount * 100),
        transaction_type: transactionType,
        category,
        occurred_on: date,
        scope,
      };
      const result = editingIndex === null
        ? await supabase.from("transactions").insert(transactionData).select("id").single()
        : await supabase.from("transactions").update(transactionData).eq("id", transactionList[editingIndex].id).select("id").single();
      if (result.error) {
        setDatabaseMessage(result.error.message);
        return;
      }
      setDatabaseMessage("Saved securely to Supabase.");
    }

    const nextTransaction: Transaction = {
        title,
        person,
        category,
        amount: transactionType === "expense" ? -amount : amount,
        date: date === "2026-10-29" ? "Today" : date,
        type: transactionType,
        scope,
        initials: person.charAt(0).toUpperCase(),
      };

    setTransactionList((current) => editingIndex === null
      ? [nextTransaction, ...current]
      : current.map((transaction, index) => index === editingIndex ? nextTransaction : transaction));
    setEditingIndex(null);
    setIsFormOpen(false);
    event.currentTarget.reset();
  }

  async function deleteTransaction(index: number) {
    if (householdId && transactionList[index].id) {
      const { error } = await createSupabaseBrowserClient().from("transactions").delete().eq("id", transactionList[index].id);
      if (error) {
        setDatabaseMessage(error.message);
        return;
      }
      setDatabaseMessage("Deleted securely from Supabase.");
    }
    setTransactionList((current) => current.filter((_, transactionIndex) => transactionIndex !== index));
  }

  function exportCsv() {
    const header = "Description,Person,Category,Amount (INR),Date,Type,Visibility";
    const rows = visibleTransactions.map(({ transaction }) => [
      transaction.title,
      transaction.person,
      transaction.category,
      Math.abs(transaction.amount),
      transaction.date,
      transaction.type,
      transaction.scope,
    ].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","));
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "homewise-transactions.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-slate-900">
      <div className="mx-auto flex max-w-[1440px]">
        <aside className="hidden min-h-screen w-64 shrink-0 border-r border-slate-200 bg-white px-5 py-7 lg:block">
          <div className="mb-12 flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-xl font-bold text-white">H</div>
            <div>
              <p className="text-lg font-bold tracking-tight">Homewise</p>
              <p className="text-xs text-slate-400">Household money, simplified</p>
            </div>
          </div>
          <nav className="space-y-2 text-sm font-medium">
            <a className="flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-emerald-700" href="#overview"><span>◈</span> Overview</a>
            <a className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-500 hover:bg-slate-50" href="#transactions"><span>↕</span> Transactions</a>
            <a className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-500 hover:bg-slate-50" href="#budgets"><span>▤</span> Budgets</a>
            <a className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-500 hover:bg-slate-50" href="#bills"><span>◷</span> Bills & payments</a>
            <a className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-500 hover:bg-slate-50" href="#settings"><span>⚙</span> Household settings</a>
          </nav>
          <div className="mt-auto pt-72">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-500">DEMO MODE</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">This dashboard uses fake data while we build Homewise.</p>
            </div>
            <a className="mt-5 flex items-center gap-3 px-4 text-sm text-slate-500" href="#settings"><span>⚙</span> Settings</a>
          </div>
        </aside>

        <section className="min-w-0 flex-1 px-5 py-6 sm:px-8 lg:px-10 lg:py-9">
          <header className="mb-8 flex items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-sm font-medium text-emerald-700">Wednesday, 29 October 2026</p>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Good morning, Anika</h1>
              <p className="mt-2 text-sm text-slate-500">Here is your household&apos;s money overview.</p>
            </div>
            <div className="flex items-center gap-3">
              <button className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm sm:block">October 2026⌄</button>
              <button onClick={openAddForm} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700">+ Add transaction</button>
              <AuthButton />
            </div>
          </header>

          <div className="mb-7 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-800">
            <span className="font-semibold">{householdId ? "Connected data:" : "Demo data:"}</span> {householdId ? "Saved transactions are protected by your Supabase household permissions." : "These numbers are examples to help you explore the dashboard. They are not connected to a bank account."}
            <div className="mt-2"><HouseholdStatus onHouseholdReady={handleHouseholdReady} /></div>
            {isDatabaseLoading && <p className="mt-2 text-xs text-slate-500">Checking saved transactions...</p>}
            {databaseMessage && <p className="mt-2 text-xs text-slate-600">{databaseMessage}</p>}
          </div>
          <HouseholdSettings householdId={householdId} currentUserId={userId} onCategoriesChange={setCategoryOptions} />

          <div id="overview" className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-emerald-600 p-5 text-white shadow-sm">
              <p className="text-sm text-emerald-100">Money left this month</p>
              <p className="mt-3 text-3xl font-bold">{formatInr(41850)}</p>
              <p className="mt-3 text-xs text-emerald-100">↑ 12% from last month</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Total income</p>
              <p className="mt-3 text-2xl font-bold">{formatInr(72000)}</p>
              <p className="mt-3 text-xs text-emerald-600">This month</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Total spending</p>
              <p className="mt-3 text-2xl font-bold">{formatInr(30150)}</p>
              <p className="mt-3 text-xs text-slate-400">42% of income</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Upcoming bills</p>
              <p className="mt-3 text-2xl font-bold">{formatInr(4098)}</p>
              <p className="mt-3 text-xs text-amber-600">3 due this month</p>
            </div>
          </div>

          <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" id="members">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="font-bold">Your household</h2>
                <p className="mt-1 text-xs text-slate-400">People included in this demo household</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">{members.length} members</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {members.map((member) => (
                <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3" key={member.name}>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${member.color}`}>{member.initials}</div>
                  <div><p className="text-sm font-semibold">{member.name}</p><p className="text-xs text-slate-400">{member.role}</p></div>
                </div>
              ))}
            </div>
          </section>

          <div className="mb-8 grid gap-6 xl:grid-cols-[1.2fr_1fr]">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <div><h2 className="font-bold">Monthly cash flow</h2><p className="mt-1 text-xs text-slate-400">Income and spending in thousands of rupees</p></div>
                <div className="flex gap-3 text-xs text-slate-500"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />Income</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-slate-300" />Spending</span></div>
              </div>
              <div className="flex h-44 items-end justify-between gap-3 border-b border-slate-100 px-2">
                {monthlyFlow.map((month) => (
                  <div className="flex h-full flex-1 items-end justify-center gap-1" key={month.month}>
                    <div className="w-3 rounded-t-md bg-emerald-500 sm:w-5" style={{ height: `${month.income * 1.8}px` }} title={`${month.month} income ₹${month.income}k`} />
                    <div className="w-3 rounded-t-md bg-slate-300 sm:w-5" style={{ height: `${month.spending * 1.8}px` }} title={`${month.month} spending ₹${month.spending}k`} />
                    <span className="absolute mt-52 text-xs text-slate-400">{month.month}</span>
                  </div>
                ))}
              </div>
              <p className="mt-8 text-xs text-slate-400">Transfers between household members are excluded from this household view.</p>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" id="categories">
              <div className="mb-5 flex items-center justify-between"><div><h2 className="font-bold">Budget progress</h2><p className="mt-1 text-xs text-slate-400">Keep shared spending on track</p></div><button className="text-sm font-semibold text-emerald-700">Edit</button></div>
              <div className="space-y-5">
                {budgetPlans.map((budget) => {
                  const percentage = Math.min(100, Math.round((budget.spent / budget.limit) * 100));
                  return <div key={budget.label}><div className="mb-2 flex justify-between text-sm"><span className="font-medium text-slate-600">{budget.label}</span><span className="text-slate-500">{formatInr(budget.spent)} <span className="text-slate-300">/</span> {formatInr(budget.limit)}</span></div><div className="h-2 rounded-full bg-slate-100"><div className={`h-2 rounded-full ${budget.color}`} style={{ width: `${percentage}%` }} /></div><p className="mt-1 text-right text-xs text-slate-400">{percentage}% used</p></div>;
                })}
              </div>
            </section>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" id="transactions">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="font-bold">Recent transactions</h2>
                  <p className="mt-1 text-xs text-slate-400">Your latest household activity</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={exportCsv} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Export CSV</button>
                  <button onClick={openAddForm} className="rounded-lg px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">Add new →</button>
                </div>
              </div>
              <div className="mb-5 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search transactions..." aria-label="Search transactions" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Filter by transaction type" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 outline-none focus:border-emerald-500">
                  <option value="all">All types</option><option value="income">Income</option><option value="expense">Expense</option><option value="transfer">Transfer</option>
                </select>
                <select value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value)} aria-label="Filter by visibility" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 outline-none focus:border-emerald-500">
                  <option value="all">All visibility</option><option value="shared">Shared</option><option value="personal">Personal</option>
                </select>
              </div>
              <div className="space-y-1">
                {visibleTransactions.map(({ transaction, index }) => (
                  <div className="flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-slate-50" key={`${transaction.title}-${transaction.date}`}>
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${transaction.type === "income" ? "bg-emerald-100 text-emerald-700" : transaction.type === "transfer" ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-600"}`}>{transaction.initials}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{transaction.title}</p>
                      <p className="text-xs text-slate-400">{transaction.person} · {transaction.category} · <span className={transaction.scope === "personal" ? "text-violet-600" : "text-emerald-600"}>{transaction.scope}</span></p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${transaction.type === "income" ? "text-emerald-600" : transaction.type === "transfer" ? "text-violet-600" : "text-slate-700"}`}>{transaction.type === "expense" ? "-" : "+"}{formatInr(Math.abs(transaction.amount))}</p>
                      <p className="text-xs text-slate-400">{transaction.date}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEditForm(index)} aria-label={`Edit ${transaction.title}`} className="rounded-lg p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700">✎</button>
                      <button onClick={() => deleteTransaction(index)} aria-label={`Delete ${transaction.title}`} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600">×</button>
                    </div>
                  </div>
                ))}
              </div>
              {visibleTransactions.length === 0 && <p className="rounded-xl bg-slate-50 py-8 text-center text-sm text-slate-500">No transactions match these filters.</p>}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" id="budgets">
              <div className="mb-6">
                <h2 className="font-bold">Spending by category</h2>
                <p className="mt-1 text-xs text-slate-400">Where your money went this month</p>
              </div>
              <div className="space-y-5">
                {categorySpending.map((category) => (
                  <div key={category.label}>
                    <div className="mb-2 flex justify-between text-sm"><span className="font-medium text-slate-600">{category.label}</span><span className="font-semibold">{formatInr(category.amount)}</span></div>
                    <div className="h-2 rounded-full bg-slate-100"><div className={`h-2 rounded-full ${category.color}`} style={{ width: category.width }} /></div>
                  </div>
                ))}
              </div>
              <button className="mt-7 w-full rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Manage budgets</button>
            </section>
          </div>

          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" id="bills">
            <div className="mb-5 flex items-center justify-between">
              <div><h2 className="font-bold">Upcoming bills</h2><p className="mt-1 text-xs text-slate-400">Plan ahead for what is due next</p></div>
              <button className="rounded-lg px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">See calendar →</button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {upcomingBills.map((bill) => (
                <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3" key={bill.name}>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-lg ${bill.color}`}>₹</div>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{bill.name}</p><p className="text-xs text-slate-400">{bill.date} · {bill.dueDate}</p></div>
                  <p className="text-sm font-bold">{formatInr(bill.amount)}</p>
                </div>
              ))}
            </div>
          </section>
          <p className="mt-8 text-center text-xs text-slate-400">Homewise keeps money conversations clear, private, and judgment-free.</p>
        </section>
      </div>
      {isFormOpen && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-950/30 p-4" role="dialog" aria-modal="true" aria-labelledby="transaction-form-title">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700">Demo transaction</p>
                <h2 id="transaction-form-title" className="mt-1 text-xl font-bold">{editingTransaction ? "Edit money activity" : "Add money activity"}</h2>
                <p className="mt-1 text-sm text-slate-500">This will appear in the dashboard only for now.</p>
              </div>
              <button onClick={() => { setIsFormOpen(false); setEditingIndex(null); }} aria-label="Close form" className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100">×</button>
            </div>
            <form key={editingIndex ?? "new"} onSubmit={addTransaction} className="space-y-4">
              <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-1">
                {(["expense", "income", "transfer"] as const).map((type) => (
                  <button type="button" key={type} onClick={() => setTransactionType(type)} className={`rounded-lg py-2 text-sm font-semibold capitalize ${transactionType === type ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500"}`}>{type}</button>
                ))}
              </div>
              {transactionType === "transfer" && <p className="rounded-xl bg-violet-50 px-3 py-2 text-xs leading-5 text-violet-700">A transfer moves money between household members. It will not increase household income or spending.</p>}
              <label className="block text-sm font-semibold text-slate-700">Description
                <input required name="description" defaultValue={editingTransaction?.title} placeholder={transactionType === "income" ? "e.g. Freelance payment" : "e.g. Weekly groceries"} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700">Amount (₹)
                  <input required min="1" step="1" type="number" name="amount" defaultValue={editingTransaction ? Math.abs(editingTransaction.amount) : undefined} placeholder="0" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">Person
                  <select name="person" defaultValue={editingTransaction?.person ?? "Anika"} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-emerald-500">
                    {members.map((member) => <option key={member.name}>{member.name}</option>)}
                  </select>
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700">Category
                  <select name="category" defaultValue={editingTransaction?.category ?? "Groceries"} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-emerald-500">
                    {categoryOptions.map((category) => <option key={category}>{category}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-semibold text-slate-700">Date
                  <input required type="date" name="date" defaultValue={editingTransaction?.date.match(/^\d{4}-\d{2}-\d{2}$/) ? editingTransaction.date : "2026-10-29"} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-emerald-500" />
                </label>
              </div>
              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-slate-700">Who is this for?</legend>
                <div className="flex gap-2">
                  <label className="flex-1 cursor-pointer rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-sm text-emerald-700"><input defaultChecked={editingTransaction?.scope !== "personal"} name="scope" value="shared" type="radio" className="mr-2" />Shared</label>
                  <label className="flex-1 cursor-pointer rounded-xl border border-slate-200 px-3 py-2 text-center text-sm text-slate-600"><input defaultChecked={editingTransaction?.scope === "personal"} name="scope" value="personal" type="radio" className="mr-2" />Personal</label>
                </div>
              </fieldset>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setIsFormOpen(false); setEditingIndex(null); }} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
                <button type="submit" className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">{editingTransaction ? "Save changes" : "Save demo transaction"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
