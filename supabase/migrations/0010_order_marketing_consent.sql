-- Records whether the buyer had granted marketing (Meta Pixel) consent at the
-- moment the order was created.
--
-- Why this column exists: Meta's Conversions API fires from the Razorpay
-- webhook, which is a server-to-server POST from RAZORPAY — it carries
-- Razorpay's cookies, never the visitor's. Reading the consent cookie in the
-- webhook therefore always finds nothing, which silently skipped CAPI for
-- every purchase. Consent is instead captured at /api/checkout, where the
-- browser really is present and its cookies really are sent, and read back
-- here from the order row.
--
-- Default false: an order with no recorded consent is not reported to Meta.
alter table public.orders
  add column if not exists marketing_consent boolean not null default false;

comment on column public.orders.marketing_consent is
  'Whether the buyer had granted Meta/marketing consent at checkout; governs whether the webhook sends a CAPI Purchase event.';