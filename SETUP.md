# SemesterSync v4 setup (about 20 minutes)
1. Create a free project at supabase.com. In Authentication > Providers keep Email on.
2. SQL Editor: paste and run backend/schema.sql.
3. Put the project URL and anon key in www/config.js.
4. Feed: `npm i -g supabase`, `supabase link`, then `supabase functions deploy ics --no-verify-jwt` (copy backend/ics/index.ts to supabase/functions/ics/index.ts first).
5. App: copy www/* into your Capacitor www folder, then
   `npm i @capacitor/local-notifications`
   add to capacitor.config.json:  "plugins": { "CapacitorHttp": { "enabled": true } }
   `npx cap sync android` and rebuild. If reminders fire late on Android 12+, add
   <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM"/> to AndroidManifest.xml.
6. Open the app: Sign in > Create account > Create organisation (you become admin). Make invite codes for faculty and students.

## v5 notes
- Existing Supabase project: run only the `v5 additions` block at the bottom of backend/schema.sql (audit log, delete account).
- Google/Microsoft sign-in: enable the provider in Supabase Authentication > Providers (needs your OAuth client ID/secret) and add your site URL to Redirect URLs. Works in the browser/web version; the Android app still uses email sign-in.
- Admin console: host the `www` folder as a website (Netlify, Vercel, Supabase Storage) and admins use it from a laptop.
