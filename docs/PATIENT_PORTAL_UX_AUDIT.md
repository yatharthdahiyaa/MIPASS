# Patient portal: UX audit, dimensions and feature plan

Date: 2026-11-14. Scope: `apps/frontend` patient portal (`/patient/*`).

## Status (2026-11-14)

Sections 1–3 and the frontend-only features in 4 are implemented. Re-measured afterwards at 1440×900 and 390×844 with an empty account and with a populated one (a week of check-ins, two medicines, profile details, entered through the portal's own API calls; both accounts deleted afterwards):

- 44 screens, no horizontal overflow, no console errors; `next build` passes.
- One card radius (14px), one control radius (10px); pills only on chips, badges and avatars.
- Control heights 40 / 32 (28 for extra-small); text sizes are 13 meta, 14 secondary, 15 body, 17 card title, 24/28 page title, 12 on badges, 16 in phone inputs.
- The only dashed border left is the X-ray drop zone.

| Item | Done |
|---|---|
| 1.1 corners, 1.3 type, 2 dimension spec | Role tokens in `app/globals.css` (`rounded-control`, `rounded-surface`, `text-meta/body/title/page`); `components/ui/*` retuned to them |
| 1.2 containers in containers | Empty states are a sentence and at most one action, no dashed box or icon tile |
| 1.4 one primary per screen | Header owns the primary; empty states hand setup actions to the checklist; dose "Taken" is secondary |
| 1.5 unbalanced columns | Overview, Medicines, Log, X-rays (first visit) and Profile rebuilt on equal-height rows |
| 1.5b header weight | Setup checklist replaces the two stacked banners |
| 1.6 assistant overlap | Floating button removed; trigger in the sidebar footer (desktop) and top bar (phone) |
| 1.7 small items | 40px phone top-bar targets; tabs on the control scale |
| 4.1 notifications and security in the portal | Profile tabs: Health details, Alerts, Security, Data & privacy |
| 4.2 setup checklist | Overview, from real overview fields only |
| 4.5 undo | Daily log deletes wait for the toast's Undo before calling the API |
| 4.7 search and sort | Records: text search, category, newest/oldest, all in the URL |
| 4.8 (partly) | `.ics` download for upcoming scheduled consultations |
| 4.9 visit summary | `/patient/summary`, prints on white without the app chrome |
| Button table: reading rows | Each latest reading opens its trend on the Daily log (`?metric=`) |

Still open, each needs backend work: 4.3 edit log entries and document details, 4.4 refill tracking, 4.6 share a single result, 4.8 reschedule, 4.10 personal ranges.

## How this was measured

- Headless Chromium against the running dev stack, signed in as a fresh, empty patient account (since deleted).
- Viewports: 1440×900 (desktop), 1280×720 (laptop), 390×844 (phone). 7 screens each, 21 captures.
- Per screen: bounding boxes of cards, buttons, inputs, tabs, badges and the assistant button; computed radius and font size; every distinct text size; any element under 36px; horizontal overflow.
- Design reference: the Impeccable rules (operate-mode UI: consistent controls, one elevation mechanism, 12–16px card radius, pills only on small controls, no nested containers, clear type steps).

**Limits.** The account had no data, so every screen was an empty state. Populated layouts (X-ray results, records list, dose lists, trend charts, message threads) were read from code but not measured. Re-run the measurement once there is representative real data. Nothing here uses mock rows.

No screen overflows horizontally at any of the three sizes.

---

## 1. Why it reads as "cheap": ranked causes

### 1.1 Two corner systems fighting each other (highest impact)

| Element | Measured radius |
|---|---|
| Cards, textarea | 16.8px |
| Buttons (all sizes), text inputs, selects, tabs, chips, badges, progress | **31.2px** (`rounded-4xl`, a full pill) |

A 132×36 button or a 1068×44 form field is a long pill sitting inside a 16.8px card. Wide pills read as consumer-app styling, not a medical record. Textareas are 16.8px while the input above them is 31px, so fields in one form do not match.

**Fix:** controls 10px (`rounded-lg`), cards 14px, pills only for chips, badges and the assistant button. Change once in `components/ui/{button,input,native-select,tabs,badge,toggle}.tsx` and every screen follows.

### 1.2 Containers inside containers

Empty states are a card holding a **dashed** box holding an icon tile and a pill button (Overview ×4, Medicines, Care team, Records, X-rays). That is three layers to say "nothing here yet". The Overview "Latest readings" card is 630×281 and 80% of it is the empty box.

**Fix:** drop the dashed box inside cards. Use plain centred text plus one action. Keep the dashed border only for the X-ray drop zone, where it means "drop here".

### 1.3 Type scale is flat and inconsistent

Distinct sizes in `main`: 12, 14, 15, 16, 18, 20, 30/36 (8 steps).

- Body and labels: 14px. Inputs: 16px. Default button and tabs: 15px. Small button: 14px. Four sizes for one form row.
- Card titles are 18px under a 36px page title (2:1) with nothing between.
- A 36px page title on a 14px interface is oversized for a working app; it pushes the first card down ~100px on every page.

**Fix:** a 4-step scale: 13 meta · 15 body and controls · 18 card title · 28 page title (24 on phone). One size for button, input and tab labels.

### 1.4 Competing primary buttons and repeated calls to action

- Overview: header "Log today's check-in" (white pill) **and** the empty-state "Log today's check-in" (white pill) at once. Same for "Add medicine" on Medicines (header and empty state).
- White-on-dark primary pills 202×44 are the loudest thing on screen even when the action is optional.

**Fix:** one primary per screen. Empty states use a secondary button or a text link. The header owns the primary action.

### 1.5 Unbalanced column heights

Measured at 1440 on Overview: left column is one card, 281px. Right column is three cards, 281+304+273 plus gaps ≈ 898px. The left column ends at y≈735 and leaves **~620px of dead space** beside the Care team and X-ray cards.

| Screen | Left | Right | Problem |
|---|---|---|---|
| Overview | 630×281 | 466×(281+304+273) | 3.2:1 height mismatch |
| Daily log | form 508×1056 (aspect 0.48) | Trends 584×~120 | tall form beside a short chart; empty void below |
| Medicines | Today's doses 639×165 | two stat cards 457×96 each (=208) | tops align, bottoms do not (165 vs 208) |
| X-rays | upload card 360×530 | empty panel 732×268 | different heights; floating empty box |
| Profile | form 655×800 | 4 cards 108/422/144/192 | uneven stack |

**Fix:** put cards in the same row on one grid with `items-stretch`. Move the lone tall card (Care team, X-ray) into the left column under Latest readings, or use a 7/5 two-column layout with two cards per column. On Daily log, place Trends above the form or make the form two columns inside one 8/4 split.

### 1.5b Page header spacing

- Overview greeting block + 2 buttons + "Today" strip + 2 notice banners push real content below the fold at 1440×900 (first data card starts at y≈453).
- On phone (390×844) the two notice banners fill the whole first screen under the header. Page height 2272px.

### 1.6 Assistant button overlaps content

56×56 round button, fixed bottom-right, 24px from the edges. It covers the "Open" link of the Care team card (Overview), the right edge of the note textarea (Care), and notice text on phone (above the 5-item tab bar).

**Fix:** reserve space (`pb-24` on `main`, already `pb-28/32` but the button sits inside the content width), or dock it into the sidebar footer on desktop and into the tab bar on phone.

### 1.7 Smaller issues

- Tabs (Doctors / Messages / Consultations) are 37px tall; buttons are 36 or 44; chips 36. Pick 40 and 32 and use only those.
- Phone top bar: avatar link is 32×32, the MIPAAS logo link 87×26. Both are under the 44px touch target.
- Notification bell shows "1" on a brand-new account. Verify it points at something real and clears on open.
- Date input shows `14-11-2026` (locale format inside a native control) while every other date in the app is `14 Nov 2026`.

---

## 2. Dimension spec to adopt

| Token | Now | Proposed |
|---|---|---|
| Control height | 44 default / 36 sm / 28 xs | **40 / 32 / 28**; 48 only for the phone primary |
| Control radius | 31.2 (pill) | **10px** |
| Card radius | 16.8 | **14px** |
| Card padding | 24 (16 small) | 20 desktop / 16 phone |
| Page title | 36 / 30 phone | **28 / 24 phone**, weight 600 |
| Card title | 18 | 17 semibold |
| Body, labels, controls | 14 / 15 / 16 mixed | **15** (inputs 16 on phone to stop iOS zoom) |
| Meta | 12 | 13 |
| Progress bar | 12 default (6 override) | 6 |
| Page grid | 1180 content, mixed fr | 12 col; 8/4 or 7/5; equal-height rows |
| Touch targets (phone) | 32 avatar, 26 logo | ≥44 hit area |
| Sidebar | 256 | keep; 240 is enough but not worth changing |

Aspect-ratio guide for widgets (width:height): stat cell ≈ 2.8:1 (currently 2.9, fine); list cards 1.6–2:1 (currently 1.5–2.2, fine); form cards should not exceed ~1.2:1 tall. The 0.26–0.5 ratios on Daily log, Care and Profile mean the form is one long column; split into two columns at ≥1024px.

---

## 3. Buttons and controls: what each one should do

Every control below exists today unless marked NEW. "Done when" is the acceptance test.

| Screen | Control | Today | Change | Done when |
|---|---|---|---|---|
| Shell | Assistant button | covers content | move/reserve space; show unread/active state | never overlaps a control at 390–1920px |
| Shell | Bell | opens list | add "Mark all read", link to notification settings (NEW, see 4.1) | count matches `/notifications/badge`; clears after read |
| Shell | Language select | fine | keep | persists after reload |
| Overview | Log check-in / Upload X-ray | two pills | one primary, one outline | one primary visible |
| Overview | Notices (verify e-mail, complete profile) | stacked banners | single "Get set up" list with progress (4.2) | disappears when all real conditions are met |
| Overview | Reading tiles | static | click opens that metric's trend on Daily log, with the metric pre-selected (NEW) | deep link `/patient/log?metric=glucose` |
| Daily log | Save check-in | one long form | two-column form, sticky save bar; keep optional fields | save disabled with no values; success toast with Undo (4.5) |
| Daily log | Trend range 7/30/90 | pills | segmented control, 32px | selection persists in URL |
| Daily log | History row | Delete only | add **Edit** (4.3) | edit pre-fills form, saves, updates trends |
| Medicines | Add medicine | header + empty state | header only | one primary |
| Medicines | Dose Taken / Skipped | exists | keep; add Undo | status reverts server-side |
| Medicines | Pause/Resume | exists | add **Refill** and **ends on** reminders (4.4) | low-stock banner when refill date is within 7 days |
| X-rays | Upload & analyse | disabled until file | show reason when disabled ("Choose a file first") | tooltip/inline text |
| X-rays | Result view | existing | Download report, Share with a connected doctor (4.6) | doctor sees it only if scope granted |
| Records | Filter by category | exists | add text search (4.7) | filters as you type, keeps category |
| Records | Upload | exists | rename, change category/date (4.3b) | PATCH persists |
| Care team | Invite | needs verified e-mail | keep; replace banner with inline disabled state + resend | explains why disabled |
| Care team | Scope chips | exists (`updateScopes`) | add "Last accessed by doctor" line (needs audit data) | only shown if backend provides it |
| Care team | Consultations | request, cancel | add **Reschedule**, add-to-calendar `.ics` (4.8) | calendar file opens in default app |
| Profile | Save | exists | add Security card: change password, 2-step, active sessions (reuse `SecurityPanel`) (4.1) | each action works without leaving the portal |
| Profile | Download my data | exists | choose JSON or readable PDF (4.9) | file opens |
| Profile | Delete account | exists | keep, require password (already) | |

---

## 4. Features to add (only what real data supports)

All features below use data the user enters or the backend already stores. No placeholder rows, no sample data.

### 4.1 Notification and security settings inside the portal  — *backend exists*
- `GET/PUT /notifications/preferences`, `GET /auth/sessions`, `DELETE /auth/sessions/<id>`, MFA endpoints already exist, but their UI lives only on `/account` (`SecurityPanel`).
- Add a "Notifications" and "Security" card to Profile that reuse those components.
- Done when: a patient can change alert kinds, see and sign out other devices, and turn on 2-step verification without leaving `/patient/profile`.

### 4.2 Setup checklist replacing the banners  — *frontend only*
- Steps from real overview fields: e-mail verified (`email_verified`), profile completeness (`profile.completeness`), first check-in (`counts`/streak), first medicine, connected doctor (`care.doctors`).
- Shows "3 of 5 done", each row has its action. Hides when complete.
- Done when: no step shows as incomplete once the real condition is satisfied; nothing is shown that the backend does not report.

### 4.3 Edit log entries and document details  — *needs backend*
- `PATCH /patient/logs/<id>` (same validation as POST) and `PATCH /patient/documents/<id>` (title, category, date, notes).
- Done when: editing a reading recomputes trends and status chips; audit log records the change.

### 4.4 Medicine refill tracking  — *needs backend*
- Add `quantity_on_hand`, `refill_due` to `Medication`; decrement on "Taken"; PATCH exists.
- Show low-supply notice on Overview and Medicines when ≤ 7 days.
- Done when: marking doses reduces the count; no notice appears when the field is empty.

### 4.5 Undo for destructive and status actions  — *frontend only*
- Replace "Are you sure" dialogs for dose status and log delete with an Undo toast (10s). Keep the dialog for account, X-ray and document deletion.
- Done when: pressing Undo restores the row via the API.

### 4.6 Share a result with a connected doctor  — *backend partly exists*
- Care scopes already include `xrays`. Add a per-result "Share with Dr …" action that grants the scope for that study and notifies the doctor.
- Done when: doctor's record view shows the study; revoking removes it.

### 4.7 Search and sort  — *frontend only*
- Text search across Records and X-rays (title, filename, category), sort by date. History on Daily log: "Load more" beyond the selected range.
- Done when: filters combine and survive navigation (URL params).

### 4.8 Consultation calendar and reschedule  — *needs small backend change*
- Existing: create, list, cancel. Add reschedule (`PATCH /patient/consults/<id>`) and an `.ics` download generated client-side from the stored time.
- Done when: rescheduling notifies the doctor; `.ics` opens with the correct time zone.

### 4.9 Printable visit summary  — *frontend only*
- A print stylesheet for a one-page summary (profile, active medicines, last readings, latest X-ray result) built from the existing export data.
- Done when: browser print produces one A4 page with no sidebar or buttons.

### 4.10 Personal ranges for vitals  — *needs backend*
- Let the patient (or an approved doctor) set target ranges; status chips use them instead of fixed defaults (`vitals.tsx` today).
- Done when: the same reading shows a different chip after the range changes.

---

## 5. Suggested order

1. **Foundation:** radius, control heights, type scale, button hierarchy (sections 1.1, 1.3, 1.4, 2). One change in `components/ui/*` restyles every screen.
2. **Layout:** equal-height rows, two-column forms, Overview rebalance, assistant button placement (1.2, 1.5, 1.6).
3. **Quick wins, frontend only:** setup checklist (4.2), search (4.7), undo (4.5), print (4.9), Profile security/notification cards (4.1).
4. **Backend-backed:** edit logs/documents (4.3), refill (4.4), reschedule (4.8), share (4.6), personal ranges (4.10).

## 6. Re-test checklist

- Re-run the measurement at 1440, 1280, 390 with a populated account (real entries).
- Tab through each screen: visible focus ring, logical order, assistant button reachable.
- Contrast on muted text and placeholders (AA 4.5:1) in the dark theme.
- Long names and Hindi, Bengali, Tamil and Telugu strings in buttons and tabs (the app ships 5 languages).
