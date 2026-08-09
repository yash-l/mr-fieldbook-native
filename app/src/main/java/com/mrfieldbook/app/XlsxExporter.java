package com.mrfieldbook.app;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

final class XlsxExporter {
    private XlsxExporter() {}

    static byte[] create(String workbookJson) throws Exception {
        JSONObject root = new JSONObject(workbookJson == null ? "{}" : workbookJson);
        JSONArray inputSheets = root.optJSONArray("sheets");
        if (inputSheets == null || inputSheets.length() == 0) {
            throw new IllegalArgumentException("Workbook has no sheets");
        }

        List<SheetData> sheets = new ArrayList<>();
        Set<String> usedNames = new HashSet<>();
        for (int i = 0; i < inputSheets.length(); i++) {
            JSONObject item = inputSheets.optJSONObject(i);
            if (item == null) continue;
            String name = uniqueSheetName(item.optString("name", "Sheet" + (i + 1)), usedNames);
            JSONArray rows = item.optJSONArray("rows");
            sheets.add(new SheetData(name, rows == null ? new JSONArray() : rows));
        }
        if (sheets.isEmpty()) throw new IllegalArgumentException("Workbook has no valid sheets");

        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(bytes, StandardCharsets.UTF_8)) {
            write(zip, "[Content_Types].xml", contentTypes(sheets.size()));
            write(zip, "_rels/.rels", rootRels());
            write(zip, "docProps/app.xml", appProperties(sheets));
            write(zip, "docProps/core.xml", coreProperties());
            write(zip, "xl/workbook.xml", workbookXml(sheets));
            write(zip, "xl/_rels/workbook.xml.rels", workbookRels(sheets.size()));
            write(zip, "xl/styles.xml", stylesXml());
            for (int i = 0; i < sheets.size(); i++) {
                write(zip, "xl/worksheets/sheet" + (i + 1) + ".xml", sheetXml(sheets.get(i).rows));
            }
        }
        return bytes.toByteArray();
    }

    private static void write(ZipOutputStream zip, String path, String content) throws Exception {
        ZipEntry entry = new ZipEntry(path);
        zip.putNextEntry(entry);
        zip.write(content.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }

    private static String contentTypes(int sheetCount) {
        StringBuilder out = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>")
                .append("<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">")
                .append("<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>")
                .append("<Default Extension=\"xml\" ContentType=\"application/xml\"/>")
                .append("<Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/>")
                .append("<Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/>")
                .append("<Override PartName=\"/docProps/core.xml\" ContentType=\"application/vnd.openxmlformats-package.core-properties+xml\"/>")
                .append("<Override PartName=\"/docProps/app.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.extended-properties+xml\"/>");
        for (int i = 1; i <= sheetCount; i++) {
            out.append("<Override PartName=\"/xl/worksheets/sheet").append(i)
                    .append(".xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>");
        }
        return out.append("</Types>").toString();
    }

    private static String rootRels() {
        return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
                "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" +
                "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/>" +
                "<Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties\" Target=\"docProps/core.xml\"/>" +
                "<Relationship Id=\"rId3\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties\" Target=\"docProps/app.xml\"/>" +
                "</Relationships>";
    }

    private static String workbookXml(List<SheetData> sheets) {
        StringBuilder out = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>")
                .append("<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">")
                .append("<bookViews><workbookView/></bookViews><sheets>");
        for (int i = 0; i < sheets.size(); i++) {
            out.append("<sheet name=\"").append(xml(sheets.get(i).name)).append("\" sheetId=\"")
                    .append(i + 1).append("\" r:id=\"rId").append(i + 1).append("\"/>");
        }
        return out.append("</sheets><calcPr calcId=\"191029\"/></workbook>").toString();
    }

    private static String workbookRels(int sheetCount) {
        StringBuilder out = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>")
                .append("<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">");
        for (int i = 1; i <= sheetCount; i++) {
            out.append("<Relationship Id=\"rId").append(i)
                    .append("\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet")
                    .append(i).append(".xml\"/>");
        }
        out.append("<Relationship Id=\"rId").append(sheetCount + 1)
                .append("\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/>");
        return out.append("</Relationships>").toString();
    }

    private static String stylesXml() {
        return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
                "<styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">" +
                "<fonts count=\"2\"><font><sz val=\"11\"/><name val=\"Calibri\"/></font><font><b/><sz val=\"11\"/><color rgb=\"FFFFFFFF\"/><name val=\"Calibri\"/></font></fonts>" +
                "<fills count=\"3\"><fill><patternFill patternType=\"none\"/></fill><fill><patternFill patternType=\"gray125\"/></fill><fill><patternFill patternType=\"solid\"><fgColor rgb=\"FF0A6C62\"/><bgColor indexed=\"64\"/></patternFill></fill></fills>" +
                "<borders count=\"1\"><border><left/><right/><top/><bottom/><diagonal/></border></borders>" +
                "<cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/></cellStyleXfs>" +
                "<cellXfs count=\"2\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/><xf numFmtId=\"0\" fontId=\"1\" fillId=\"2\" borderId=\"0\" xfId=\"0\" applyFont=\"1\" applyFill=\"1\"/></cellXfs>" +
                "<cellStyles count=\"1\"><cellStyle name=\"Normal\" xfId=\"0\" builtinId=\"0\"/></cellStyles>" +
                "</styleSheet>";
    }

    private static String sheetXml(JSONArray rows) {
        StringBuilder out = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>")
                .append("<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">")
                .append("<sheetViews><sheetView workbookViewId=\"0\"><pane ySplit=\"1\" topLeftCell=\"A2\" activePane=\"bottomLeft\" state=\"frozen\"/></sheetView></sheetViews>")
                .append("<sheetFormatPr defaultRowHeight=\"15\"/><cols><col min=\"1\" max=\"40\" width=\"19\" customWidth=\"1\"/></cols><sheetData>");
        for (int r = 0; r < rows.length(); r++) {
            JSONArray row = rows.optJSONArray(r);
            if (row == null) continue;
            int rowNumber = r + 1;
            out.append("<row r=\"").append(rowNumber).append("\">");
            for (int c = 0; c < row.length(); c++) {
                Object value = row.opt(c);
                if (value == null || value == JSONObject.NULL) value = "";
                String ref = columnName(c + 1) + rowNumber;
                String style = r == 0 ? " s=\"1\"" : "";
                if (value instanceof Number) {
                    out.append("<c r=\"").append(ref).append("\"").append(style).append("><v>")
                            .append(value.toString()).append("</v></c>");
                } else if (value instanceof Boolean) {
                    out.append("<c r=\"").append(ref).append("\" t=\"b\"").append(style).append("><v>")
                            .append(Boolean.TRUE.equals(value) ? "1" : "0").append("</v></c>");
                } else {
                    String text = String.valueOf(value);
                    out.append("<c r=\"").append(ref).append("\" t=\"inlineStr\"").append(style).append("><is><t xml:space=\"preserve\">")
                            .append(xml(text)).append("</t></is></c>");
                }
            }
            out.append("</row>");
        }
        return out.append("</sheetData><autoFilter ref=\"A1:AZ1\"/></worksheet>").toString();
    }

    private static String appProperties(List<SheetData> sheets) {
        StringBuilder titles = new StringBuilder();
        for (SheetData sheet : sheets) titles.append("<vt:lpstr>").append(xml(sheet.name)).append("</vt:lpstr>");
        return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
                "<Properties xmlns=\"http://schemas.openxmlformats.org/officeDocument/2006/extended-properties\" xmlns:vt=\"http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes\">" +
                "<Application>MR Machine Intelligence</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop>" +
                "<HeadingPairs><vt:vector size=\"2\" baseType=\"variant\"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>" + sheets.size() + "</vt:i4></vt:variant></vt:vector></HeadingPairs>" +
                "<TitlesOfParts><vt:vector size=\"" + sheets.size() + "\" baseType=\"lpstr\">" + titles + "</vt:vector></TitlesOfParts>" +
                "</Properties>";
    }

    private static String coreProperties() {
        String instant = Instant.now().toString();
        return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
                "<cp:coreProperties xmlns:cp=\"http://schemas.openxmlformats.org/package/2006/metadata/core-properties\" xmlns:dc=\"http://purl.org/dc/elements/1.1/\" xmlns:dcterms=\"http://purl.org/dc/terms/\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\">" +
                "<dc:creator>MR Machine Intelligence</dc:creator><cp:lastModifiedBy>MR Machine Intelligence</cp:lastModifiedBy>" +
                "<dcterms:created xsi:type=\"dcterms:W3CDTF\">" + instant + "</dcterms:created>" +
                "<dcterms:modified xsi:type=\"dcterms:W3CDTF\">" + instant + "</dcterms:modified></cp:coreProperties>";
    }

    private static String uniqueSheetName(String requested, Set<String> used) {
        String clean = requested == null ? "Sheet" : requested.replaceAll("[\\\\/*?:\\[\\]]", " ").trim();
        if (clean.isEmpty()) clean = "Sheet";
        if (clean.length() > 31) clean = clean.substring(0, 31);
        String base = clean;
        int number = 2;
        while (used.contains(clean.toLowerCase(Locale.ROOT))) {
            String suffix = " " + number++;
            clean = base.substring(0, Math.min(base.length(), 31 - suffix.length())) + suffix;
        }
        used.add(clean.toLowerCase(Locale.ROOT));
        return clean;
    }

    private static String columnName(int column) {
        StringBuilder out = new StringBuilder();
        int n = column;
        while (n > 0) {
            n--;
            out.insert(0, (char) ('A' + (n % 26)));
            n /= 26;
        }
        return out.toString();
    }

    private static String xml(String value) {
        if (value == null) return "";
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < value.length(); i++) {
            char ch = value.charAt(i);
            if (ch < 0x20 && ch != '\t' && ch != '\n' && ch != '\r') continue;
            switch (ch) {
                case '&': out.append("&amp;"); break;
                case '<': out.append("&lt;"); break;
                case '>': out.append("&gt;"); break;
                case '"': out.append("&quot;"); break;
                case '\'': out.append("&apos;"); break;
                default: out.append(ch);
            }
        }
        return out.toString();
    }

    private static final class SheetData {
        final String name;
        final JSONArray rows;
        SheetData(String name, JSONArray rows) { this.name = name; this.rows = rows; }
    }
}
