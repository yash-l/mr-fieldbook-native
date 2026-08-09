package com.mrone.fieldapp;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

final class ReportPackExporter {
    private ReportPackExporter() {}

    static byte[] create(String packJson) throws Exception {
        JSONObject root = new JSONObject(packJson == null ? "{}" : packJson);
        JSONArray files = root.optJSONArray("files");
        if (files == null || files.length() == 0) {
            throw new IllegalArgumentException("Report pack has no files");
        }

        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        Set<String> usedNames = new HashSet<>();
        try (ZipOutputStream zip = new ZipOutputStream(bytes, StandardCharsets.UTF_8)) {
            for (int i = 0; i < files.length(); i++) {
                JSONObject item = files.optJSONObject(i);
                if (item == null) continue;
                JSONObject workbook = item.optJSONObject("workbook");
                if (workbook == null) continue;
                String requested = item.optString("fileName", "Company Report " + (i + 1) + ".xlsx");
                String fileName = uniqueFileName(requested, usedNames);
                byte[] workbookBytes = XlsxExporter.create(workbook.toString());
                ZipEntry entry = new ZipEntry(fileName);
                zip.putNextEntry(entry);
                zip.write(workbookBytes);
                zip.closeEntry();
            }
        }
        if (usedNames.isEmpty()) throw new IllegalArgumentException("Report pack has no valid workbooks");
        return bytes.toByteArray();
    }

    private static String uniqueFileName(String requested, Set<String> used) {
        String clean = requested == null ? "Company Report.xlsx" : requested.trim();
        clean = clean.replaceAll("[\\\\/:*?\"<>|]", " ").replaceAll("\\s+", " ");
        if (clean.isEmpty()) clean = "Company Report.xlsx";
        if (!clean.toLowerCase(Locale.ROOT).endsWith(".xlsx")) clean += ".xlsx";
        String base = clean.substring(0, clean.length() - 5);
        String candidate = clean;
        int number = 2;
        while (used.contains(candidate.toLowerCase(Locale.ROOT))) {
            candidate = base + " " + number++ + ".xlsx";
        }
        used.add(candidate.toLowerCase(Locale.ROOT));
        return candidate;
    }
}
