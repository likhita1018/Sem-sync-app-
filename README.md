# SemesterSync

Timetables, clash detection, change alerts, leave and cover, and a student planner for colleges.

## Get the APK
1. Push this repo to GitHub.
2. Open the **Actions** tab, then the latest **Build APK** run (it starts automatically; wait about 5 minutes).
3. Download **SemesterSync-APK** from the run's Artifacts, unzip it, and install `app-debug.apk` on an Android phone (allow "install unknown apps").

This is a test (debug) build for evaluation, not a Play Store release.

## Two ways to try it
- **Single-device demo (no setup):** the app works offline with sample data. Each phone keeps its own data.
- **Shared mode (accounts, roles, sync):** follow `SETUP.md` to create a free Supabase project, then put its URL and anon key in `www/config.js` and push again.

## What it does
Calendar and weekly timetables, room/faculty clash detection, auto-generated timetables, publish timetable to dated sessions, leave and substitute cover, change alerts, import (CSV, Excel, ICS, calendar links), export (.ics, PDF), student "My day" (attendance calculator, deadlines, goals), and, with the backend, accounts, roles, sync and calendar feeds.

## Known limits
Push notifications when the app is closed, an iPhone build, and full admin screens are not done yet.
