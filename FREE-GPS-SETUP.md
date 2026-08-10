# Free GPS setup — MR One v1.4.2

No API key is required.

1. Save a doctor's clinic/hospital address.
2. Open the doctor → tap **Find GPS FREE**.
3. MR One sends that one address to OpenStreetMap Nominatim.
4. Check the candidate on map and tap **Use this GPS** only when it matches.
5. The selected latitude/longitude is saved locally and reused offline.

Public Nominatim rules implemented by the app:
- manual/on-demand lookup only;
- one native request queue;
- minimum 1100 ms between network requests;
- local cache for repeated identical queries;
- application-identifying User-Agent;
- visible OpenStreetMap attribution;
- no autocomplete or systematic nearby-POI crawling.

Google Places remains optional for users who later configure `PLACES_API_KEY`.
