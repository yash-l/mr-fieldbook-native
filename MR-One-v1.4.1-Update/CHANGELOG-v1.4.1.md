# MR One v1.4.1 — Address to GPS hybrid patch

- Doctor profile can search Google Places using saved clinic/address.
- Shows up to 5 online matches with formatted address and a map-check action.
- GPS is never silently overwritten: user must tap **Use this GPS**.
- Confirmed result stores latitude/longitude, Place ID, resolved place name/address and source locally.
- Once saved, nearest-doctor, 50m proximity and route logic reuse the cached coordinates without another address lookup.
- Existing saved GPS can be rechecked online without deleting the old pin first.
- If internet/Places is unavailable, existing address and cached GPS remain untouched.
- Doctors with an address but no GPS get a direct **Find GPS from address** action.
- 30-day regression suite: 32,661 checks with 0 failures across direct/card/appointment/monthly/timing/GPS/route states.
