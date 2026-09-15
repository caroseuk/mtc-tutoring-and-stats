# Beat Six

Live at [beatsix.com](https://beatsix.com). A practice app for the Year 4 **Multiplication Tables Check (MTC)**, the statutory check taken in England each June. Built for children to use on an iPad (or any browser), with progress tracking and practice that adapts to what each child finds hard.

Plain HTML, CSS and JavaScript. No framework, no build step, no backend, no accounts. Progress is stored in the browser, with a backup file you can export and import.

## What's in it

- **Test Simulation** – a faithful replica of the official check: 3 practice questions, then 25 questions from the 2–12 tables, 6 seconds each with a 3 second pause, on-screen number pad or keyboard, whatever is in the box at 6 seconds is submitted. Question selection follows the DfE rules (table quotas, no reversed questions in one check, extra weight on the 6, 7, 8, 9 and 12 tables).
- **Practice** – a round of 10, 15 or 20 questions picked for the child: mostly the questions they're weakest on, some they nearly know, and a few they've mastered to keep confidence up. Instant feedback, and a missed question comes back a few questions later.
- **Times tables** – the same, but focused on one times table.
- **My progress** – an 11×11 times tables map coloured by fluency, per-table progress, a chart of Test Simulation scores, and a badge shelf.
- **Grown-ups** – behind a quick sum: every question with fluency, average time, accuracy and attempts; round history; settings; export/import backup; reset.

Several children can share one device, each with their own profile.

## How the adaptive part works

Every ordered question (2×2 … 12×12, 121 in all) keeps a running accuracy and response time. A **fluency** score blends the two (60% accuracy, 40% speed, where under 2.5s is full marks and 6s or a timeout is zero). Questions move through *not tried → learning → nearly → fluent*, and fluent questions are revisited on a spaced schedule (1, 3, 7, 14 days).

The first Test Simulation gives the starting score. Practice rounds then prioritise questions that have never been tried, so the map fills in over the first few rounds, then the weakest questions. A question known one way round (7×8) counts as a hint for the other way (8×7) but has to be proven in both.

## Run it locally

```
python3 -m http.server 8000
```

then open http://localhost:8000. Any static server works. Opening `index.html` directly from disk won't, because the app uses ES modules.

## Tests

```
npm test
```

Uses Node's built-in test runner (Node 18+). Covers the check generator (1000 generated checks validated against every official rule), the question model and round selection, rewards, and the store.

## Deploy

It's a static site. On GitHub Pages: push to `main`, enable Pages from the `main` branch root. On an iPad, open the URL in Safari and use *Share → Add to Home Screen* for a full-screen app that also works offline.

## Privacy

Nothing leaves the device. Progress lives in the browser's local storage. Use *Grown-ups → Export backup* to keep a copy or move to another device.

## Sources

- [MTC assessment framework (DfE)](https://www.gov.uk/government/publications/multiplication-tables-check-assessment-framework)
- [MTC administration guidance (DfE)](https://www.gov.uk/government/publications/multiplication-tables-check-administration-guidance)
