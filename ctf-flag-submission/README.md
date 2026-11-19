# CTF Flag Submission

A Netlify-hosted flag submission portal for a 4-flag CTF (teams of 1–2).

## Features

- **Admin-controlled timer** — players see a live countdown; submissions are blocked before start and after stop/expiry
- **2-hour window** — admin starts it; admin can also stop early
- **Teams of 1 or 2** — register with a team name + password; solo players leave member 2 blank
- **Email rule** — every member must use `name@<coursename>.christuniversity.in` (format-checked, no verification)
- **4 flags × 25 pts** — one input per flag; wrong submissions have no penalty
- **Per-member submits** — each member can submit each flag once (a teammate submitting flag 1 doesn't block you from also submitting flag 1)
- **Admin-only leaderboard** — live-updating board, ranked by **score desc → earlier last-submission wins ties**
- **Flags never reach the client** — validated server-side in Netlify Functions

## Deploy (Netlify)

1. Push this folder to a GitHub repo (or use Netlify Drop).
2. In Netlify: **Add new site → Import an existing project**.
3. Build settings are picked up from `netlify.toml` (no build command, publish `public/`).
4. Set environment variables under **Site configuration → Environment variables**:

   | Variable | Value |
   |---|---|
   | `FLAG1` | `FLAG1{R0bert_P4ttins0n_J4mes_B0nd}` |
   | `FLAG2` | `FLAG2{R0bert_P4ttins0n_B4tM4n}` |
   | `FLAG3` | `FLAG3{R0bert_P4ttins0n_Antin0us}` |
   | `FLAG4` | `FLAG4{R0bert_P4ttins0n_P3n3tr4ti0n_T3st3r}` |
   | `ADMIN_PASSWORD` | `noxeye` |
   | `MAX_TEAMS` | `40` (optional, default 40) |

5. Deploy. Storage uses **Netlify Blobs** (free, auto-provisioned — no extra setup).

## Usage

- **Players:** `https://<your-site>/`
- **Admin:** `https://<your-site>/admin/` — password `noxeye` (change `ADMIN_PASSWORD` in Netlify env if you like)

The admin path is not linked anywhere; treat it as security through obscurity on top of the password.

### Admin flow

1. Open `/admin/`, unlock with the password.
2. **Start 2-hour timer** when teams are ready — the countdown goes live for everyone.
3. Watch the leaderboard refresh every 3 seconds.
4. **Stop now** to close early, or let the clock hit zero — either way submissions lock.

## Scoring

- 25 points per distinct flag solved by the team (max 100).
- Tie-break: **earlier last successful submission** wins.
- Rank shows on the admin board only.

## Local development

```bash
npm install
npx netlify dev
```

`netlify dev` serves the site + functions locally. Blobs work in dev via the Netlify CLI.

## Structure

```
public/               static site (player page + /admin/)
netlify/functions/    serverless API (register, login, me, submit, state, admin-*)
shared/lib.mjs        shared server code (auth, flags, timer, blobs)
netlify.toml          build + /api/* redirects
```
