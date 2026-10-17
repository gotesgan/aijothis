-- Loyalty bonus for people who dismiss the paywall repeatedly.
--
-- Why this exists: someone who closes the paywall three times is being told
-- "no" three times and leaves. Rather than cut the price (which permanently
-- lowers the reference price for everyone who learns to dismiss on purpose),
-- we grant BONUS QUESTIONS at the SAME price. The pack they see already says
-- "50 questions" — with the bonus applied it says "60". Margin is untouched.
--
-- Why it lives in the DB and not localStorage: a dismissal counter held on the
-- client is forgeable (set a key to 3 and the bonus is yours) and dies with the
-- device. The server is the authority here for the same reason it is the
-- authority for quota — though it fails CLOSED, because withholding a bonus
-- costs us nothing while granting one we did not earn costs margin.
--
-- `bonus_consumed_at` makes it one-time: the bonus rides on their NEXT order
-- and the webhook stamps this once that order is fulfilled.
--
-- Legacy-cohort users (pre-2026-09-20, already paying ₹60/70/80) are excluded
-- in code — see packQuestionsFor() in src/lib/pricing.ts. A "discount" for
-- them would be a 41% price INCREASE.

alter table public.profiles
  add column if not exists paywall_dismissals integer not null default 0,
  add column if not exists bonus_earned_at timestamptz,
  add column if not exists bonus_consumed_at timestamptz;

comment on column public.profiles.paywall_dismissals is
  'Times this person closed the paywall without buying. Reaching PAYWALL_DISMISSALS_FOR_BONUS earns the loyalty bonus (see src/lib/pricing.ts).';
comment on column public.profiles.bonus_earned_at is
  'When the dismissal threshold was first crossed. Analytics only — entitlement is derived from paywall_dismissals so a missed timestamp cannot deny a bonus.';
comment on column public.profiles.bonus_consumed_at is
  'When the earned bonus was spent on a fulfilled order. Non-null means the one-time bonus has been used.';