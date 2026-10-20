# DDH app module map

Current safe split:
- index.html: markup only
- css/style.css: all visual styling
- js/data.js: preloaded static data exports
- js/app.js: current runtime, Firebase, filters, renderers, animation

Next extraction targets:
- js/firebase.js: Firebase config, auth, load/save
- js/filters.js: date and machine filtering helpers
- js/renderDashboard.js: dashboard cards, charts and drill status panel
- js/renderKuyular.js: underground well list, edit/delete row rendering
- js/animation.js: canvas rig drawing and animation loop

Keep app.js as the integration shell while moving one module at a time.

## Hakediş approval email pilot

The review action uses a Firebase callable function in `functions/` to send a
single Outlook email to the configured test mailbox. The email link opens the
app's “Kontrol Bekliyor” list after the reviewer signs in. A failed email send
does not move the hakediş into the review state.

Before enabling the pilot:

1. Confirm that the Firebase project uses the Blaze plan and that SMTP AUTH is
   enabled for the Microsoft 365 mailbox.
2. From the `functions/` directory, install dependencies with `npm install`.
3. Copy `functions/.env.example` to `functions/.env.ddh-gumustas`.
4. Set the Outlook SMTP password as a Firebase secret; do not put it in a
   source file or commit it:
   `firebase functions:secrets:set OUTLOOK_SMTP_PASSWORD --project ddh-gumustas`
5. Deploy the function:
   `firebase deploy --only functions --project ddh-gumustas`

The initial pilot is restricted to `eray.demircan@gumustasmaden.com.tr` as
both the test sender and approver. The same address is configured in the app
and the server function. Do not add real approvers until role management and
the server-side authorization rules are expanded beyond this single-user test.

## Date-based tariff discount

A 5% discount applies to drilling, waiting, and in-well measurement rates from
September 1, 2026. Earlier records use undiscounted rates; records on or after
that date use discounted rates. Legacy in-well measurements require a date
