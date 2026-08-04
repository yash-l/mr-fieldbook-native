package com.mrfieldbook.app;

import android.content.Context;
import android.util.Base64;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

import javax.xml.parsers.DocumentBuilderFactory;

final class SpreadsheetParser {
    private SpreadsheetParser() {}

    static String parse(Context context, String fileName, String base64Data) throws Exception {
        String lower = fileName == null ? "" : fileName.toLowerCase(Locale.ROOT);
        byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
        List<Sheet> sheets;
        if (lower.endsWith(".csv")) {
            sheets = new ArrayList<>();
            sheets.add(new Sheet("CSV", readCsv(new ByteArrayInputStream(bytes))));
        } else if (lower.endsWith(".xlsx")) {
            File temp = File.createTempFile("mr-import-", ".xlsx", context.getCacheDir());
            try (FileOutputStream out = new FileOutputStream(temp)) {
                out.write(bytes);
            }
            try {
                sheets = readXlsx(temp);
            } finally {
                //noinspection ResultOfMethodCallIgnored
                temp.delete();
            }
        } else if (lower.endsWith(".xls")) {
            throw new IllegalArgumentException("Old .xls format is not supported offline. Open it in Excel or Google Sheets, save as .xlsx, then import.");
        } else {
            throw new IllegalArgumentException("Choose an .xlsx or .csv file");
        }

        StringBuilder json = new StringBuilder("{\"sheets\":[");
        for (int i = 0; i < sheets.size(); i++) {
            if (i > 0) json.append(',');
            Sheet sheet = sheets.get(i);
            json.append("{\"name\":").append(quote(sheet.name)).append(",\"rows\":[");
            for (int r = 0; r < sheet.rows.size(); r++) {
                if (r > 0) json.append(',');
                List<String> row = sheet.rows.get(r);
                json.append('[');
                for (int c = 0; c < row.size(); c++) {
                    if (c > 0) json.append(',');
                    json.append(quote(row.get(c)));
                }
                json.append(']');
            }
            json.append("]}");
        }
        return json.append("]}").toString();
    }

    static String quote(String value) {
        if (value == null) value = "";
        StringBuilder out = new StringBuilder("\"");
        for (int i = 0; i < value.length(); i++) {
            char ch = value.charAt(i);
            switch (ch) {
                case '\\': out.append("\\\\"); break;
                case '"': out.append("\\\""); break;
                case '\b': out.append("\\b"); break;
                case '\f': out.append("\\f"); break;
                case '\n': out.append("\\n"); break;
                case '\r': out.append("\\r"); break;
                case '\t': out.append("\\t"); break;
                default:
                    if (ch < 0x20) out.append(String.format(Locale.US, "\\u%04x", (int) ch));
                    else out.append(ch);
            }
        }
        return out.append('"').toString();
    }

    private static List<List<String>> readCsv(InputStream in) throws Exception {
        List<List<String>> rows = new ArrayList<>();
        BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8));
        String line;
        while ((line = reader.readLine()) != null) rows.add(parseCsvLine(line));
        return rows;
    }

    private static List<String> parseCsvLine(String line) {
        List<String> out = new ArrayList<>();
        StringBuilder cell = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < line.length(); i++) {
            char ch = line.charAt(i);
            if (ch == '"') {
                if (quoted && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    cell.append('"');
                    i++;
                } else {
                    quoted = !quoted;
                }
            } else if (ch == ',' && !quoted) {
                out.add(cell.toString());
                cell.setLength(0);
            } else {
                cell.append(ch);
            }
        }
        out.add(cell.toString());
        return out;
    }

    private static List<Sheet> readXlsx(File file) throws Exception {
        List<Sheet> sheets = new ArrayList<>();
        try (ZipFile zip = new ZipFile(file)) {
            List<String> shared = readSharedStrings(zip);
            for (int sheetIndex = 1; sheetIndex <= 100; sheetIndex++) {
                ZipEntry entry = zip.getEntry("xl/worksheets/sheet" + sheetIndex + ".xml");
                if (entry == null) {
                    if (sheetIndex > 8) break;
                    continue;
                }
                List<List<String>> rows = new ArrayList<>();
                Document document = parseXml(zip.getInputStream(entry));
                NodeList rowNodes = document.getElementsByTagName("row");
                for (int r = 0; r < rowNodes.getLength(); r++) {
                    Element rowElement = (Element) rowNodes.item(r);
                    NodeList cells = rowElement.getElementsByTagName("c");
                    List<String> row = new ArrayList<>();
                    for (int ci = 0; ci < cells.getLength(); ci++) {
                        Element cellElement = (Element) cells.item(ci);
                        int column = columnIndex(cellElement.getAttribute("r"));
                        while (row.size() <= column) row.add("");
                        String type = cellElement.getAttribute("t");
                        String value = "";
                        if ("inlineStr".equals(type)) {
                            NodeList texts = cellElement.getElementsByTagName("t");
                            StringBuilder combined = new StringBuilder();
                            for (int t = 0; t < texts.getLength(); t++) combined.append(texts.item(t).getTextContent());
                            value = combined.toString();
                        } else {
                            NodeList values = cellElement.getElementsByTagName("v");
                            if (values.getLength() > 0) value = values.item(0).getTextContent();
                            if ("s".equals(type)) {
                                try {
                                    value = shared.get(Integer.parseInt(value));
                                } catch (Exception ignored) {
                                    value = "";
                                }
                            }
                        }
                        row.set(column, value == null ? "" : value);
                    }
                    rows.add(row);
                }
                sheets.add(new Sheet("Sheet" + sheetIndex, rows));
            }
        }
        if (sheets.isEmpty()) throw new IllegalArgumentException("No worksheet found in this .xlsx file");
        return sheets;
    }

    private static List<String> readSharedStrings(ZipFile zip) throws Exception {
        List<String> values = new ArrayList<>();
        ZipEntry entry = zip.getEntry("xl/sharedStrings.xml");
        if (entry == null) return values;
        Document document = parseXml(zip.getInputStream(entry));
        NodeList items = document.getElementsByTagName("si");
        for (int i = 0; i < items.getLength(); i++) {
            NodeList texts = ((Element) items.item(i)).getElementsByTagName("t");
            StringBuilder combined = new StringBuilder();
            for (int t = 0; t < texts.getLength(); t++) combined.append(texts.item(t).getTextContent());
            values.add(combined.toString());
        }
        return values;
    }

    private static Document parseXml(InputStream input) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(false);
        try { factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true); } catch (Exception ignored) {}
        try { factory.setFeature("http://xml.org/sax/features/external-general-entities", false); } catch (Exception ignored) {}
        try { factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false); } catch (Exception ignored) {}
        try { factory.setXIncludeAware(false); } catch (Exception ignored) {}
        factory.setExpandEntityReferences(false);
        return factory.newDocumentBuilder().parse(input);
    }

    private static int columnIndex(String reference) {
        int result = 0;
        for (int i = 0; i < reference.length(); i++) {
            char ch = reference.charAt(i);
            if (ch >= 'A' && ch <= 'Z') result = result * 26 + (ch - 'A' + 1);
            else if (ch >= 'a' && ch <= 'z') result = result * 26 + (ch - 'a' + 1);
            else break;
        }
        return Math.max(0, result - 1);
    }

    private static final class Sheet {
        final String name;
        final List<List<String>> rows;
        Sheet(String name, List<List<String>> rows) {
            this.name = name;
            this.rows = rows;
        }
    }
}
