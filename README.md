# Homewise

Homewise is a beginner-friendly household finance dashboard built with Next.js, TypeScript, and Tailwind CSS.

## Current status

The dashboard uses clearly labeled fake data until a signed-in household is connected. Do not use it as the only record of real finances yet. The app has authentication, Row Level Security, paise-based storage, and saved income/expense transactions, but transfers, budgets, bills, and administrator member removal are still being completed.

## Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database design

The planned Supabase schema is in [`supabase/schema.sql`](./supabase/schema.sql). Amounts are stored as whole paise (`amount_paise`), not decimal rupees. This avoids rounding errors.

If the original schema has already been run, apply only the migration in [`supabase/migrations/002_create_household_function.sql`](./supabase/migrations/002_create_household_function.sql). Do not rerun the full schema, because its tables already exist.

For member invitations, profile names, and custom categories, then apply [`supabase/migrations/003_members_and_categories.sql`](./supabase/migrations/003_members_and_categories.sql). Existing transactions keep their recorded category name when a category is renamed or deleted.

- `households` stores one household and its display currency.
- `household_members` connects signed-in users to a household.
- `transactions` stores income, expenses, and internal transfers.
- `transaction_viewers` allows an owner to explicitly share a personal transaction.
- `budgets` stores monthly category limits.
- `recurring_bills` stores upcoming bill dates.

Row Level Security policies ensure that database permissions are checked by Supabase, not only by the website. Household transfers are labeled separately and must be excluded from household income and spending totals.

## Environment variables

Copy `.env.example` to `.env.local` only after creating a Supabase project. Never commit `.env.local` or real keys.

## Beginner glossary

- **Repository:** the project folder tracked by Git.
- **Commit:** a saved checkpoint describing a set of code changes.
- **Push:** sending local commits to GitHub.
- **Branch:** a separate line of work that can be merged later.
- **Database:** organized storage that the app can query.
- **Row Level Security (RLS):** database rules that decide which signed-in user can read or change each row.
- **Environment variable:** local configuration such as a Supabase URL; `.env.local` keeps it out of source control.

## Safe data rules

- Amounts are entered as rupees in the form and stored as whole paise in Supabase.
- Internal transfers must not be included in household income or spending totals.
- Personal transactions should only be visible to their owner or explicitly allowed viewers.
- Use **Export CSV** before deleting records if you need an offline copy.
- To delete a user's saved data, first export it, then use Supabase Table Editor to remove that user's household membership and owned records. Review the rows carefully before confirming deletion.
- Never put a Supabase secret/service-role key in `.env.local`, browser code, or GitHub.

## Before real household use

1. Confirm Row Level Security is enabled for every table in `supabase/schema.sql`.
2. Test with two separate accounts: shared records, personal records, and a denied personal record.
3. Configure an email provider instead of relying on Supabase's development email rate limits.
4. Back up exported CSV data.
5. Keep the public deployment on fake data until all tests pass.
