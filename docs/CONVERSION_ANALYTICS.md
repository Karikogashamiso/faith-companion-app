# Measuring landing-page conversion

The marketing site now records an anonymous funnel so you can compute the
conversion rate of the best apps in the niche and optimize toward it.

## What's tracked

Anonymous events → `public.landing_events` (via `/api/public/track`, keyed by a
localStorage `anon_id`):

| Event | When | Props |
|-------|------|-------|
| `landing_view` | page load | — |
| `cta_click` | any "Start free" / primary CTA | `location` (hero, how, pricing_free, pricing_companion, final) |
| `store_badge_click` | App Store / Play badge | `store`, `location` |
| `demo_ask` | the live AI demo returns an answer | — |

When a visitor signs up, the onboarding screen fires one authenticated
`landing_conversion` event into `public.analytics_events` with
`props.anon_id` = the same id — so the anonymous visit links to the account.

## The conversion funnel (SQL)

```sql
-- Top of funnel (unique visitors / clickers / demo users), last 30 days.
select event, count(*) as events, count(distinct anon_id) as visitors
from public.landing_events
where created_at > now() - interval '30 days'
group by event order by visitors desc;

-- View → CTA-click rate.
select
  count(distinct anon_id) filter (where event = 'landing_view')  as views,
  count(distinct anon_id) filter (where event = 'cta_click')     as clickers,
  round(100.0 * count(distinct anon_id) filter (where event = 'cta_click')
             / nullif(count(distinct anon_id) filter (where event = 'landing_view'), 0), 1) as cta_rate_pct
from public.landing_events
where created_at > now() - interval '30 days';

-- Visit → signup conversion (joins the anonymous funnel to created accounts).
select
  count(distinct le.anon_id) as visitors,
  count(distinct ae.props->>'anon_id') as signups,
  round(100.0 * count(distinct ae.props->>'anon_id')
             / nullif(count(distinct le.anon_id), 0), 2) as signup_rate_pct
from public.landing_events le
left join public.analytics_events ae
  on ae.event = 'landing_conversion'
 and ae.props->>'anon_id' = le.anon_id
where le.event = 'landing_view'
  and le.created_at > now() - interval '30 days';

-- Which CTA placement converts best.
select props->>'location' as cta_location, count(distinct anon_id) as clickers
from public.landing_events
where event = 'cta_click'
group by 1 order by clickers desc;
```

## Notes

- Best-effort & privacy-light: no cookies, no PII, no third-party scripts — just
  a random `anon_id` in localStorage. Click events use `navigator.sendBeacon`
  so they're not lost to the navigation to `/auth`.
- The endpoint accepts only an allowlist of event names and caps props size, so
  the open route can't be abused as arbitrary storage.
- Benchmarks to aim for in this niche: landing→signup of ~3–8% is healthy for a
  warm/organic audience; paid traffic typically converts lower. Compare CTA
  placements and iterate on the hero headline + first screen.
