#!/bin/sh
# Copies the app's report logic into the "reports" Edge Function, so the emailed report
# is computed exactly like the in-app report. Run before deploying the function.
set -e
D=supabase/functions/reports/lib
mkdir -p $D
cp js/report.js js/plan.js js/adhkar.js $D/
# Only the session sanitizer is needed from clean.js
sed '/^export function cleanCall/,$d' js/clean.js > $D/clean.js
# plan.js only needs TOTAL_PAGES from quran.js
printf "// Shim for the Edge Function: plan.js only needs the page count.\nexport const TOTAL_PAGES = 604;\n" > $D/quran.js
echo "copied report modules into $D"
