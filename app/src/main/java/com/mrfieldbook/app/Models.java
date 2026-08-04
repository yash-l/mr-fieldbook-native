package com.mrfieldbook.app;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

final class Models {
    private Models() {}

    static final class Doctor {
        long id;
        String name = "";
        String hospital = "";
        String address = "";
        long chemistId;
        String chemistName = "";
        String meetingDays = "";
        String meetingTime1 = "";
        String meetingTime2 = "";
        double latitude;
        double longitude;
        String notes = "";
        long dueFollowUp;

        String title() {
            return hospital == null || hospital.trim().isEmpty() ? name : name + " — " + hospital;
        }

        String timingText() {
            String days = meetingDays == null || meetingDays.isEmpty() ? "Days not set" : meetingDays.replace(',', ' ');
            String times = "";
            if (meetingTime1 != null && !meetingTime1.isEmpty()) times = formatTime(meetingTime1);
            if (meetingTime2 != null && !meetingTime2.isEmpty()) times += (times.isEmpty() ? "" : " / ") + formatTime(meetingTime2);
            return times.isEmpty() ? days + " · Time not set" : days + " · " + times;
        }
    }

    static final class Chemist {
        long id;
        String name = "";
        String address = "";
        double latitude;
        double longitude;
        String notes = "";
    }

    static final class Product {
        long id;
        String name = "";
        boolean active = true;
    }

    static final class Visit {
        long id;
        long doctorId;
        String doctorTitle = "";
        String chemistName = "";
        long visitedAt;
        double latitude;
        double longitude;
        String notes = "";
        long followUpAt;
        String productSummary = "";
    }

    static final class Metrics {
        int inputs;
        int baskets;
        int towels;
        int conversations;
        int availability;
        double pob;
    }

    static String formatDateTime(long millis) {
        if (millis <= 0) return "";
        return new SimpleDateFormat("dd MMM, hh:mm a", Locale.getDefault()).format(new Date(millis));
    }

    static String formatDate(long millis) {
        if (millis <= 0) return "";
        return new SimpleDateFormat("dd MMM yyyy", Locale.getDefault()).format(new Date(millis));
    }

    static String formatTime(String hhmm) {
        try {
            Date d = new SimpleDateFormat("HH:mm", Locale.US).parse(hhmm);
            return new SimpleDateFormat("hh:mm a", Locale.getDefault()).format(d);
        } catch (Exception e) {
            return hhmm == null ? "" : hhmm;
        }
    }
}
