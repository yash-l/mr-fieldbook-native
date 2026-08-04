package com.mrfieldbook.app;

import android.content.Context;
import android.net.Uri;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

final class LegacyJsonImporter {
    static final class Result {
        int doctors;
        int chemists;
        int products;
        int visits;
        String message() {
            return "Migrated " + doctors + " doctors, " + chemists + " chemists, " + products + " products and " + visits + " meetings from the old web app.";
        }
    }

    private LegacyJsonImporter() {}

    static Result importUri(Context context, Db db, Uri uri) throws Exception {
        String raw;
        try (InputStream in = context.getContentResolver().openInputStream(uri)) {
            if (in == null) throw new IllegalArgumentException("Cannot open backup");
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[32768];
            int count;
            while ((count = in.read(buffer)) > 0) out.write(buffer, 0, count);
            raw = out.toString("UTF-8");
        }
        JSONObject root = new JSONObject(raw);
        JSONArray doctors = root.optJSONArray("doctors");
        JSONArray chemists = root.optJSONArray("chemists");
        JSONArray visits = root.optJSONArray("visits");
        if (doctors == null || chemists == null || visits == null) throw new IllegalArgumentException("Not a valid MR Daily Auto JSON backup");

        Result result = new Result();
        Map<String, Long> chemistIds = new HashMap<>();
        Map<String, Long> doctorIds = new HashMap<>();
        Map<String, Long> productIds = new HashMap<>();

        for (int i = 0; i < chemists.length(); i++) {
            JSONObject c = chemists.optJSONObject(i);
            if (c == null) continue;
            String name = clean(c.optString("name"));
            if (name.isEmpty()) continue;
            long id = db.upsertChemist(name, clean(c.optString("address")), c.optDouble("latitude", 0), c.optDouble("longitude", 0), clean(c.optString("notes")));
            chemistIds.put(c.optString("id"), id);
            result.chemists++;
        }

        JSONArray products = root.optJSONArray("products");
        if (products != null) for (int i = 0; i < products.length(); i++) {
            JSONObject p = products.optJSONObject(i);
            if (p == null) continue;
            String name = clean(p.optString("name"));
            if (name.isEmpty()) continue;
            long id = db.upsertProduct(name);
            productIds.put(p.optString("id"), id);
            result.products++;
        }

        for (int i = 0; i < doctors.length(); i++) {
            JSONObject d = doctors.optJSONObject(i);
            if (d == null) continue;
            String name = clean(d.optString("name"));
            if (name.isEmpty()) continue;
            String hospital = first(d, "hospital", "clinic", "hospitalName");
            String oldChemist = first(d, "linkedChemistId", "chemistId");
            long chemistId = chemistIds.containsKey(oldChemist) ? chemistIds.get(oldChemist) : 0;
            if (chemistId == 0) {
                String chemistName = clean(d.optString("chemistName"));
                if (!chemistName.isEmpty()) chemistId = db.upsertChemist(chemistName, "", 0, 0, "");
            }
            String days = dayCodes(d.opt("meetingDays"));
            String time1 = clean(d.optString("meetingFrom"));
            String time2 = clean(d.optString("meetingFrom2"));
            long id = db.upsertDoctor(0, name, hospital, clean(d.optString("address")), chemistId, days, time1, time2,
                    d.optDouble("latitude", 0), d.optDouble("longitude", 0), clean(d.optString("notes")));
            doctorIds.put(d.optString("id"), id);
            result.doctors++;
        }

        JSONObject profile = root.optJSONObject("profile");
        if (profile != null) {
            if (!clean(profile.optString("hq")).isEmpty()) db.setSetting("hq", clean(profile.optString("hq")));
            if (!clean(profile.optString("tmName")).isEmpty()) db.setSetting("tm_name", clean(profile.optString("tmName")));
            if (!clean(profile.optString("joinWorkWith")).isEmpty()) db.setSetting("join_work", clean(profile.optString("joinWorkWith")));
        }

        JSONObject opening = root.optJSONObject("opening");
        int openingCalls = opening == null ? 0 : opening.optInt("calls", 0);
        if (opening != null) {
            db.setSetting("opening_inputs", String.valueOf(opening.optInt("inputs", 0)));
            db.setSetting("opening_baskets", String.valueOf(opening.optInt("basket", 0)));
            db.setSetting("opening_towels", String.valueOf(opening.optInt("towel", 0)));
            db.setSetting("opening_conversations", String.valueOf(opening.optInt("conversation", 0)));
            db.setSetting("opening_availability", String.valueOf(opening.optInt("newAvailability", 0)));
            db.setSetting("opening_pob", String.valueOf(opening.optDouble("pobValue", 0)));
        }

        int nonMeetingCalls = 0;
        int todayNonMeetingCalls = 0;
        for (int i = 0; i < visits.length(); i++) {
            JSONObject v = visits.optJSONObject(i);
            if (v == null) continue;
            long when = parseDate(first(v, "date", "createdAt"));
            if (when <= 0) when = System.currentTimeMillis();
            String day = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date(when));
            db.addMetricsForDate(day, v.optInt("inputs", 0), v.optInt("basket", 0), v.optInt("towel", 0),
                    v.optInt("conversation", 0), v.optInt("newAvailability", 0), v.optDouble("pobValue", 0));

            String oldDoctor = first(v, "doctorId", "entityId");
            long doctorId = doctorIds.containsKey(oldDoctor) ? doctorIds.get(oldDoctor) : 0;
            boolean doctorMeeting = doctorId > 0 && ("doctor".equals(v.optString("entityType")) || !oldDoctor.isEmpty());
            int calls = Math.max(0, v.optInt("calls", doctorMeeting ? 1 : 0));
            if (!doctorMeeting) {
                nonMeetingCalls += calls;
                if (day.equals(Db.todayKey())) todayNonMeetingCalls += calls;
                continue;
            }
            Models.Doctor doctor = db.getDoctor(doctorId);
            Map<Long, String> statuses = new LinkedHashMap<>();
            JSONObject oldStatuses = v.optJSONObject("productStatuses");
            if (oldStatuses != null) {
                JSONArray names = oldStatuses.names();
                if (names != null) for (int k = 0; k < names.length(); k++) {
                    String oldProductId = names.optString(k);
                    Long newProductId = productIds.get(oldProductId);
                    if (newProductId == null) continue;
                    String oldStatus = oldStatuses.optString(oldProductId);
                    statuses.put(newProductId, "prescribed".equals(oldStatus) ? "P" : "not_prescribed".equals(oldStatus) ? "N" : "F");
                }
            }
            long follow = parseDate(first(v, "followUpDate", "nextFollowUp"));
            long visitId = db.saveVisit(doctorId, doctor == null ? 0 : doctor.chemistId, when, v.optDouble("latitude", 0), v.optDouble("longitude", 0), clean(v.optString("notes")), follow, statuses);
            if (follow > System.currentTimeMillis()) ReminderScheduler.schedule(context, visitId, doctorId, follow);
            if (calls > 1) nonMeetingCalls += calls - 1;
            result.visits++;
        }
        db.setSetting("opening_calls", String.valueOf(openingCalls + nonMeetingCalls));
        db.setSetting("base_today_date", Db.todayKey());
        db.setSetting("base_today_calls", String.valueOf(todayNonMeetingCalls));
        return result;
    }

    private static String dayCodes(Object value) {
        String[] codes = {"SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"};
        StringBuilder out = new StringBuilder();
        if (value instanceof JSONArray) {
            JSONArray a = (JSONArray) value;
            for (int i = 0; i < a.length(); i++) {
                int index = a.optInt(i, -1);
                if (index >= 0 && index < codes.length) append(out, codes[index]);
            }
        } else {
            String upper = clean(String.valueOf(value)).toUpperCase(Locale.US);
            for (String code : codes) if (upper.contains(code)) append(out, code);
        }
        return out.toString();
    }

    private static void append(StringBuilder out, String value) {
        if (out.length() > 0) out.append(',');
        out.append(value);
    }

    private static long parseDate(String value) {
        if (value == null || value.trim().isEmpty()) return 0;
        String v = value.trim();
        String[] patterns = {"yyyy-MM-dd'T'HH:mm:ss.SSSXXX", "yyyy-MM-dd'T'HH:mm:ssXXX", "yyyy-MM-dd'T'HH:mm", "yyyy-MM-dd"};
        for (String pattern : patterns) {
            try { return new SimpleDateFormat(pattern, Locale.US).parse(v).getTime(); }
            catch (Exception ignored) { }
        }
        return 0;
    }

    private static String first(JSONObject object, String... keys) {
        for (String key : keys) {
            String value = clean(object.optString(key));
            if (!value.isEmpty()) return value;
        }
        return "";
    }

    private static String clean(String value) { return value == null ? "" : value.trim(); }
}
