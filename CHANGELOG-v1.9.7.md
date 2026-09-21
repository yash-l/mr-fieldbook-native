# v1.9.7

## Route build — redesigned "Selected doctor route" screen
- New stat strip (Selected / Location ready / Needs address) with color-coded dots
  instead of the old plain 3-box grid.
- Each stop is now a card with a left color bar showing its location status at a
  glance (green = verified GPS, blue = saved GPS, amber = address only, red =
  missing), a status pill, and compact icon actions (↑ ↓ Move Check/Find) instead
  of a row of full-width buttons.
- "Open in Google Maps" is now a clearly separated call-to-action block.
- All existing behaviour is unchanged: manual reorder (↑ ↓ Move), the 9-stop
  Google Maps multi-stop limit notice, GPS refresh, and the address-missing
  guidance all work exactly as before — only the look changed, so there is
  nothing new to learn.

## "Route build patch" daily refresh — how it actually works
There is no separate server for this app (it deploys as a static site), so a
traditional daily cron job isn't part of this build. The good news: the
"Today smart patch" / Field AI list was already computed live from today's
date every time the app is opened — it doesn't need a nightly job, because
it's never stale to begin with. If you want a literal push notification or
background refresh at a fixed time even when the app isn't open, that needs a
real background service / scheduled task added to the Android app — flag it
if you want that built next, since it's a different kind of feature (an
always-on process) than a UI change.
