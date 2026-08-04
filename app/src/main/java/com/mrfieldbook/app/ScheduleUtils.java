package com.mrfieldbook.app;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;

final class ScheduleUtils {
    private ScheduleUtils() {}

    static boolean isAvailableNow(Models.Doctor d) {
        if (d == null || d.meetingDays == null || d.meetingDays.isEmpty()) return false;
        String day = new SimpleDateFormat("EEE", Locale.US).format(System.currentTimeMillis()).toUpperCase(Locale.US);
        if (!d.meetingDays.toUpperCase(Locale.US).contains(day)) return false;
        int now = Calendar.getInstance().get(Calendar.HOUR_OF_DAY) * 60 + Calendar.getInstance().get(Calendar.MINUTE);
        return near(now, d.meetingTime1) || near(now, d.meetingTime2);
    }

    private static boolean near(int now, String hhmm) {
        if (hhmm == null || hhmm.isEmpty() || !hhmm.contains(":")) return false;
        try {
            String[] p = hhmm.split(":");
            int target = Integer.parseInt(p[0]) * 60 + Integer.parseInt(p[1]);
            return Math.abs(now - target) <= 60;
        } catch (Exception e) { return false; }
    }

    static String badge(Models.Doctor d) {
        if (isAvailableNow(d)) return "AVAILABLE NOW";
        if (d == null || d.meetingDays == null || d.meetingDays.isEmpty()) return "TIMING NOT SET";
        return "SCHEDULED";
    }
}
