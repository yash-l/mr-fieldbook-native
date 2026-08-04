package com.mrfieldbook.app;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

final class Db extends SQLiteOpenHelper {
    static final String DB_NAME = "mr_fieldbook.db";
    private static final int DB_VERSION = 1;
    private final Context context;

    Db(Context context) {
        super(context, DB_NAME, null, DB_VERSION);
        this.context = context.getApplicationContext();
    }

    @Override public void onConfigure(SQLiteDatabase db) {
        super.onConfigure(db);
        db.setForeignKeyConstraintsEnabled(true);
    }

    @Override public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '')");
        db.execSQL("CREATE TABLE chemists (_id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, name_norm TEXT NOT NULL UNIQUE, address TEXT NOT NULL DEFAULT '', latitude REAL NOT NULL DEFAULT 0, longitude REAL NOT NULL DEFAULT 0, notes TEXT NOT NULL DEFAULT '', updated_at INTEGER NOT NULL)");
        db.execSQL("CREATE TABLE doctors (_id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, name_norm TEXT NOT NULL, hospital TEXT NOT NULL DEFAULT '', hospital_norm TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '', chemist_id INTEGER NOT NULL DEFAULT 0, meeting_days TEXT NOT NULL DEFAULT '', meeting_time1 TEXT NOT NULL DEFAULT '', meeting_time2 TEXT NOT NULL DEFAULT '', latitude REAL NOT NULL DEFAULT 0, longitude REAL NOT NULL DEFAULT 0, notes TEXT NOT NULL DEFAULT '', updated_at INTEGER NOT NULL, UNIQUE(name_norm,hospital_norm))");
        db.execSQL("CREATE INDEX idx_doctors_search ON doctors(name_norm,hospital_norm)");
        db.execSQL("CREATE TABLE products (_id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, name_norm TEXT NOT NULL UNIQUE, active INTEGER NOT NULL DEFAULT 1)");
        db.execSQL("CREATE TABLE visits (_id INTEGER PRIMARY KEY AUTOINCREMENT, doctor_id INTEGER NOT NULL, chemist_id INTEGER NOT NULL DEFAULT 0, visited_at INTEGER NOT NULL, latitude REAL NOT NULL DEFAULT 0, longitude REAL NOT NULL DEFAULT 0, notes TEXT NOT NULL DEFAULT '', follow_up_at INTEGER NOT NULL DEFAULT 0, FOREIGN KEY(doctor_id) REFERENCES doctors(_id) ON DELETE CASCADE)");
        db.execSQL("CREATE INDEX idx_visits_date ON visits(visited_at)");
        db.execSQL("CREATE INDEX idx_visits_followup ON visits(follow_up_at)");
        db.execSQL("CREATE TABLE visit_products (_id INTEGER PRIMARY KEY AUTOINCREMENT, visit_id INTEGER NOT NULL, product_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'F', UNIQUE(visit_id,product_id), FOREIGN KEY(visit_id) REFERENCES visits(_id) ON DELETE CASCADE, FOREIGN KEY(product_id) REFERENCES products(_id) ON DELETE CASCADE)");
        db.execSQL("CREATE TABLE daily_metrics (date TEXT PRIMARY KEY, inputs INTEGER NOT NULL DEFAULT 0, baskets INTEGER NOT NULL DEFAULT 0, towels INTEGER NOT NULL DEFAULT 0, conversations INTEGER NOT NULL DEFAULT 0, availability INTEGER NOT NULL DEFAULT 0, pob REAL NOT NULL DEFAULT 0)");
        db.execSQL("CREATE TABLE route_plan (date TEXT NOT NULL, doctor_id INTEGER NOT NULL, order_no INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(date,doctor_id), FOREIGN KEY(doctor_id) REFERENCES doctors(_id) ON DELETE CASCADE)");
        seedDefaults(db);
        seedAssets(db);
    }

    @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) { }

    static String normalize(String value) {
        if (value == null) return "";
        return value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", " ").trim().replaceAll("\\s+", " ");
    }

    static String todayKey() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(System.currentTimeMillis());
    }

    static long dayStart(long millis) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(millis);
        c.set(Calendar.HOUR_OF_DAY, 0); c.set(Calendar.MINUTE, 0); c.set(Calendar.SECOND, 0); c.set(Calendar.MILLISECOND, 0);
        return c.getTimeInMillis();
    }

    static long dayEnd(long millis) { return dayStart(millis) + 86_400_000L - 1; }

    private void seedDefaults(SQLiteDatabase db) {
        putSetting(db, "hq", "Rajkot");
        putSetting(db, "tm_name", "Olakiya vishal");
        putSetting(db, "join_work", "IND");
        putSetting(db, "opening_calls", "176");
        putSetting(db, "base_today_date", "2026-08-04");
        putSetting(db, "base_today_calls", "12");
        putSetting(db, "opening_inputs", "0");
        putSetting(db, "opening_baskets", "0");
        putSetting(db, "opening_towels", "0");
        putSetting(db, "opening_conversations", "0");
        putSetting(db, "opening_availability", "0");
        putSetting(db, "opening_pob", "0");
        putSetting(db, "pin_salt", "");
        putSetting(db, "pin_hash", "");
        putSetting(db, "biometric_enabled", "0");
    }

    private void putSetting(SQLiteDatabase db, String key, String value) {
        ContentValues cv = new ContentValues(); cv.put("key", key); cv.put("value", value);
        db.insertWithOnConflict("settings", null, cv, SQLiteDatabase.CONFLICT_REPLACE);
    }

    private void seedAssets(SQLiteDatabase db) {
        try {
            BufferedReader br = new BufferedReader(new InputStreamReader(context.getAssets().open("seed.json"), StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(); String line;
            while ((line = br.readLine()) != null) sb.append(line);
            JSONObject root = new JSONObject(sb.toString());
            JSONArray chemists = root.optJSONArray("chemists");
            if (chemists != null) for (int i=0;i<chemists.length();i++) {
                JSONObject o = chemists.getJSONObject(i);
                upsertChemist(db, o.optString("name"), o.optString("address"), 0, 0, o.optString("notes"));
            }
            JSONArray doctors = root.optJSONArray("doctors");
            if (doctors != null) for (int i=0;i<doctors.length();i++) {
                JSONObject o = doctors.getJSONObject(i);
                long chemistId = 0;
                String chemist = o.optString("chemist");
                if (!chemist.trim().isEmpty()) chemistId = upsertChemist(db, chemist, "", 0, 0, "");
                upsertDoctor(db, 0, o.optString("name"), o.optString("hospital"), o.optString("address"), chemistId,
                        o.optString("meetingDays"), o.optString("meetingTime1"), o.optString("meetingTime2"), 0, 0, o.optString("notes"));
            }
            JSONArray products = root.optJSONArray("products");
            if (products != null) for (int i=0;i<products.length();i++) {
                JSONObject o = products.getJSONObject(i);
                upsertProduct(db, o.optString("name"));
            }
        } catch (Exception ignored) { }
    }

    String getSetting(String key, String fallback) {
        try (Cursor c = getReadableDatabase().rawQuery("SELECT value FROM settings WHERE key=?", new String[]{key})) {
            return c.moveToFirst() ? c.getString(0) : fallback;
        }
    }

    int getSettingInt(String key, int fallback) {
        try { return Integer.parseInt(getSetting(key, String.valueOf(fallback))); } catch (Exception e) { return fallback; }
    }

    double getSettingDouble(String key, double fallback) {
        try { return Double.parseDouble(getSetting(key, String.valueOf(fallback))); } catch (Exception e) { return fallback; }
    }

    void setSetting(String key, String value) { putSetting(getWritableDatabase(), key, value == null ? "" : value); }

    long upsertChemist(String name, String address, double lat, double lng, String notes) {
        return upsertChemist(getWritableDatabase(), name, address, lat, lng, notes);
    }

    private long upsertChemist(SQLiteDatabase db, String name, String address, double lat, double lng, String notes) {
        name = clean(name); if (name.isEmpty()) return 0;
        String norm = normalize(name);
        long id = 0;
        try (Cursor c = db.rawQuery("SELECT _id,address,notes,latitude,longitude FROM chemists WHERE name_norm=?", new String[]{norm})) {
            if (c.moveToFirst()) id = c.getLong(0);
        }
        ContentValues cv = new ContentValues();
        cv.put("name", name); cv.put("name_norm", norm);
        if (!clean(address).isEmpty()) cv.put("address", clean(address));
        if (lat != 0 || lng != 0) { cv.put("latitude", lat); cv.put("longitude", lng); }
        if (!clean(notes).isEmpty()) cv.put("notes", clean(notes));
        cv.put("updated_at", System.currentTimeMillis());
        if (id > 0) { db.update("chemists", cv, "_id=?", new String[]{String.valueOf(id)}); return id; }
        cv.put("address", clean(address)); cv.put("notes", clean(notes));
        return db.insertOrThrow("chemists", null, cv);
    }

    long upsertDoctor(long id, String name, String hospital, String address, long chemistId, String days, String t1, String t2, double lat, double lng, String notes) {
        return upsertDoctor(getWritableDatabase(), id, name, hospital, address, chemistId, days, t1, t2, lat, lng, notes);
    }

    private long upsertDoctor(SQLiteDatabase db, long id, String name, String hospital, String address, long chemistId, String days, String t1, String t2, double lat, double lng, String notes) {
        name = clean(name); hospital = clean(hospital);
        if (name.isEmpty()) return 0;
        String nn = normalize(name), hn = normalize(hospital);
        long existing = 0;
        try (Cursor c = db.rawQuery("SELECT _id FROM doctors WHERE name_norm=? AND hospital_norm=?", new String[]{nn,hn})) {
            if (c.moveToFirst()) existing = c.getLong(0);
        }
        if (existing > 0 && existing != id) id = existing;
        ContentValues cv = new ContentValues();
        cv.put("name", name); cv.put("name_norm", nn); cv.put("hospital", hospital); cv.put("hospital_norm", hn);
        cv.put("address", clean(address)); cv.put("chemist_id", chemistId); cv.put("meeting_days", clean(days));
        cv.put("meeting_time1", clean(t1)); cv.put("meeting_time2", clean(t2)); cv.put("latitude", lat); cv.put("longitude", lng);
        cv.put("notes", clean(notes)); cv.put("updated_at", System.currentTimeMillis());
        if (id > 0) { db.update("doctors", cv, "_id=?", new String[]{String.valueOf(id)}); return id; }
        return db.insertOrThrow("doctors", null, cv);
    }

    long upsertProduct(String name) { return upsertProduct(getWritableDatabase(), name); }
    private long upsertProduct(SQLiteDatabase db, String name) {
        name = clean(name); if (name.isEmpty()) return 0;
        ContentValues cv = new ContentValues(); cv.put("name",name); cv.put("name_norm",normalize(name)); cv.put("active",1);
        long id = db.insertWithOnConflict("products", null, cv, SQLiteDatabase.CONFLICT_IGNORE);
        if (id > 0) return id;
        try (Cursor c = db.rawQuery("SELECT _id FROM products WHERE name_norm=?", new String[]{normalize(name)})) { return c.moveToFirst()?c.getLong(0):0; }
    }

    void setProductActive(long id, boolean active) {
        ContentValues cv = new ContentValues(); cv.put("active", active ? 1 : 0);
        getWritableDatabase().update("products", cv, "_id=?", new String[]{String.valueOf(id)});
    }

    List<Models.Product> products(boolean activeOnly) {
        List<Models.Product> out = new ArrayList<>();
        String where = activeOnly ? " WHERE active=1" : "";
        try (Cursor c = getReadableDatabase().rawQuery("SELECT _id,name,active FROM products"+where+" ORDER BY name", null)) {
            while (c.moveToNext()) { Models.Product p=new Models.Product(); p.id=c.getLong(0); p.name=c.getString(1); p.active=c.getInt(2)==1; out.add(p); }
        }
        return out;
    }

    Models.Doctor getDoctor(long id) {
        try (Cursor c = getReadableDatabase().rawQuery(doctorSelect()+" WHERE d._id=?", new String[]{String.valueOf(id)})) {
            return c.moveToFirst() ? doctorFrom(c) : null;
        }
    }

    List<Models.Doctor> searchDoctors(String query, int limit) {
        String q = "%"+normalize(query)+"%";
        List<Models.Doctor> out = new ArrayList<>();
        try (Cursor c = getReadableDatabase().rawQuery(doctorSelect()+" WHERE d.name_norm LIKE ? OR d.hospital_norm LIKE ? OR c.name_norm LIKE ? OR lower(d.address) LIKE ? ORDER BY d.name LIMIT "+Math.max(1,limit), new String[]{q,q,q,"%"+clean(query).toLowerCase(Locale.ROOT)+"%"})) {
            while (c.moveToNext()) out.add(doctorFrom(c));
        }
        return out;
    }

    List<Models.Doctor> allDoctors(int limit) { return searchDoctors("", limit); }

    List<Models.Doctor> availableDoctors() {
        List<Models.Doctor> all = allDoctors(500), out = new ArrayList<>();
        for (Models.Doctor d : all) if (ScheduleUtils.isAvailableNow(d)) out.add(d);
        return out;
    }

    List<Models.Doctor> dueDoctors() {
        List<Models.Doctor> out = new ArrayList<>();
        long end = dayEnd(System.currentTimeMillis());
        String sql = doctorSelect().replace("0 AS placeholder", "f.due AS placeholder")+" JOIN (SELECT doctor_id,MIN(follow_up_at) due FROM visits WHERE follow_up_at>0 AND follow_up_at<=? GROUP BY doctor_id) f ON f.doctor_id=d._id ORDER BY f.due";
        try (Cursor c = getReadableDatabase().rawQuery(sql, new String[]{String.valueOf(end)})) {
            while (c.moveToNext()) { Models.Doctor d=doctorFrom(c); d.dueFollowUp=c.getLong(13); out.add(d); }
        }
        return out;
    }

    private String doctorSelect() {
        return "SELECT d._id,d.name,d.hospital,d.address,d.chemist_id,COALESCE(c.name,''),d.meeting_days,d.meeting_time1,d.meeting_time2,d.latitude,d.longitude,d.notes,d.updated_at,0 AS placeholder FROM doctors d LEFT JOIN chemists c ON c._id=d.chemist_id";
    }

    private Models.Doctor doctorFrom(Cursor c) {
        Models.Doctor d=new Models.Doctor(); d.id=c.getLong(0); d.name=c.getString(1); d.hospital=c.getString(2); d.address=c.getString(3);
        d.chemistId=c.getLong(4); d.chemistName=c.getString(5); d.meetingDays=c.getString(6); d.meetingTime1=c.getString(7); d.meetingTime2=c.getString(8);
        d.latitude=c.getDouble(9); d.longitude=c.getDouble(10); d.notes=c.getString(11); return d;
    }

    Models.Chemist getChemist(long id) {
        try (Cursor c = getReadableDatabase().rawQuery("SELECT _id,name,address,latitude,longitude,notes FROM chemists WHERE _id=?", new String[]{String.valueOf(id)})) {
            if (!c.moveToFirst()) return null; return chemistFrom(c);
        }
    }

    List<Models.Chemist> searchChemists(String query, int limit) {
        List<Models.Chemist> out=new ArrayList<>(); String q="%"+normalize(query)+"%";
        try (Cursor c=getReadableDatabase().rawQuery("SELECT _id,name,address,latitude,longitude,notes FROM chemists WHERE name_norm LIKE ? OR lower(address) LIKE ? ORDER BY name LIMIT "+Math.max(1,limit),new String[]{q,"%"+clean(query).toLowerCase(Locale.ROOT)+"%"})) {
            while(c.moveToNext()) out.add(chemistFrom(c));
        }
        return out;
    }

    private Models.Chemist chemistFrom(Cursor c) { Models.Chemist m=new Models.Chemist(); m.id=c.getLong(0);m.name=c.getString(1);m.address=c.getString(2);m.latitude=c.getDouble(3);m.longitude=c.getDouble(4);m.notes=c.getString(5);return m; }

    long saveVisit(long doctorId, long chemistId, long visitedAt, double lat, double lng, String notes, long followUpAt, Map<Long,String> productStatus) {
        SQLiteDatabase db=getWritableDatabase(); db.beginTransaction();
        try {
            ContentValues cv=new ContentValues(); cv.put("doctor_id",doctorId);cv.put("chemist_id",chemistId);cv.put("visited_at",visitedAt);cv.put("latitude",lat);cv.put("longitude",lng);cv.put("notes",clean(notes));cv.put("follow_up_at",followUpAt);
            long visitId=db.insertOrThrow("visits",null,cv);
            for(Map.Entry<Long,String> e:productStatus.entrySet()) { ContentValues pv=new ContentValues();pv.put("visit_id",visitId);pv.put("product_id",e.getKey());pv.put("status",e.getValue());db.insert("visit_products",null,pv); }
            if(lat!=0||lng!=0){ContentValues dc=new ContentValues();dc.put("latitude",lat);dc.put("longitude",lng);dc.put("updated_at",System.currentTimeMillis());db.update("doctors",dc,"_id=?",new String[]{String.valueOf(doctorId)});}
            db.setTransactionSuccessful(); return visitId;
        } finally { db.endTransaction(); }
    }

    List<Models.Visit> visitsForDay(long millis) { return visitsBetween(dayStart(millis),dayEnd(millis),200); }

    List<Models.Visit> visitsBetween(long from,long to,int limit) {
        List<Models.Visit> out=new ArrayList<>();
        String sql="SELECT v._id,v.doctor_id,d.name,d.hospital,COALESCE(c.name,''),v.visited_at,v.latitude,v.longitude,v.notes,v.follow_up_at FROM visits v JOIN doctors d ON d._id=v.doctor_id LEFT JOIN chemists c ON c._id=v.chemist_id WHERE v.visited_at BETWEEN ? AND ? ORDER BY v.visited_at DESC LIMIT "+Math.max(1,limit);
        try(Cursor c=getReadableDatabase().rawQuery(sql,new String[]{String.valueOf(from),String.valueOf(to)})){
            while(c.moveToNext()){Models.Visit v=new Models.Visit();v.id=c.getLong(0);v.doctorId=c.getLong(1);String h=c.getString(3);v.doctorTitle=h==null||h.isEmpty()?c.getString(2):c.getString(2)+" — "+h;v.chemistName=c.getString(4);v.visitedAt=c.getLong(5);v.latitude=c.getDouble(6);v.longitude=c.getDouble(7);v.notes=c.getString(8);v.followUpAt=c.getLong(9);v.productSummary=visitProductSummary(v.id);out.add(v);}
        }
        return out;
    }

    String visitProductSummary(long visitId) {
        StringBuilder sb=new StringBuilder();
        try(Cursor c=getReadableDatabase().rawQuery("SELECT p.name,vp.status FROM visit_products vp JOIN products p ON p._id=vp.product_id WHERE vp.visit_id=? ORDER BY p.name",new String[]{String.valueOf(visitId)})){
            while(c.moveToNext()){if(sb.length()>0)sb.append(" · ");String s=c.getString(1);sb.append(c.getString(0)).append(": ").append("P".equals(s)?"Prescribed":"N".equals(s)?"Not prescribed":"No feedback");}
        }
        return sb.toString();
    }

    int todayCalls() {
        int base = todayKey().equals(getSetting("base_today_date","")) ? getSettingInt("base_today_calls",0) : 0;
        return base + countVisits(dayStart(System.currentTimeMillis()),dayEnd(System.currentTimeMillis()));
    }

    int cumulativeCalls() { return getSettingInt("opening_calls",0)+countVisits(0,Long.MAX_VALUE); }

    int monthCalls() {
        Calendar c=Calendar.getInstance();c.set(Calendar.DAY_OF_MONTH,1);long from=dayStart(c.getTimeInMillis());c.add(Calendar.MONTH,1);long to=dayStart(c.getTimeInMillis())-1;
        int base=0;String baseDate=getSetting("base_today_date","");if(baseDate.startsWith(new SimpleDateFormat("yyyy-MM",Locale.US).format(System.currentTimeMillis())))base=getSettingInt("base_today_calls",0);
        return base+countVisits(from,to);
    }

    private int countVisits(long from,long to) {
        try(Cursor c=getReadableDatabase().rawQuery("SELECT COUNT(*) FROM visits WHERE visited_at BETWEEN ? AND ?",new String[]{String.valueOf(from),String.valueOf(to)})){return c.moveToFirst()?c.getInt(0):0;}
    }

    Models.Metrics metrics(String date) {
        Models.Metrics m=new Models.Metrics();
        try(Cursor c=getReadableDatabase().rawQuery("SELECT inputs,baskets,towels,conversations,availability,pob FROM daily_metrics WHERE date=?",new String[]{date})){
            if(c.moveToFirst()){m.inputs=c.getInt(0);m.baskets=c.getInt(1);m.towels=c.getInt(2);m.conversations=c.getInt(3);m.availability=c.getInt(4);m.pob=c.getDouble(5);}
        }return m;
    }

    Models.Metrics cumulativeMetrics() {
        Models.Metrics m=new Models.Metrics();
        try(Cursor c=getReadableDatabase().rawQuery("SELECT COALESCE(SUM(inputs),0),COALESCE(SUM(baskets),0),COALESCE(SUM(towels),0),COALESCE(SUM(conversations),0),COALESCE(SUM(availability),0),COALESCE(SUM(pob),0) FROM daily_metrics",null)){
            if(c.moveToFirst()){m.inputs=c.getInt(0)+getSettingInt("opening_inputs",0);m.baskets=c.getInt(1)+getSettingInt("opening_baskets",0);m.towels=c.getInt(2)+getSettingInt("opening_towels",0);m.conversations=c.getInt(3)+getSettingInt("opening_conversations",0);m.availability=c.getInt(4)+getSettingInt("opening_availability",0);m.pob=c.getDouble(5)+getSettingDouble("opening_pob",0);}
        }return m;
    }

    void adjustMetric(String field,int delta) {
        if(!isMetricField(field))return;String date=todayKey();SQLiteDatabase db=getWritableDatabase();db.execSQL("INSERT OR IGNORE INTO daily_metrics(date) VALUES(?)",new Object[]{date});db.execSQL("UPDATE daily_metrics SET "+field+"=MAX(0,"+field+"+?) WHERE date=?",new Object[]{delta,date});
    }

    void addPob(double amount) {String date=todayKey();SQLiteDatabase db=getWritableDatabase();db.execSQL("INSERT OR IGNORE INTO daily_metrics(date) VALUES(?)",new Object[]{date});db.execSQL("UPDATE daily_metrics SET pob=MAX(0,pob+?) WHERE date=?",new Object[]{amount,date});}

    void addMetricsForDate(String date,int inputs,int baskets,int towels,int conversations,int availability,double pob) {
        if(date==null||!date.matches("\\d{4}-\\d{2}-\\d{2}"))return;
        SQLiteDatabase db=getWritableDatabase();
        db.execSQL("INSERT OR IGNORE INTO daily_metrics(date) VALUES(?)",new Object[]{date});
        db.execSQL("UPDATE daily_metrics SET inputs=MAX(0,inputs+?),baskets=MAX(0,baskets+?),towels=MAX(0,towels+?),conversations=MAX(0,conversations+?),availability=MAX(0,availability+?),pob=MAX(0,pob+?) WHERE date=?",new Object[]{inputs,baskets,towels,conversations,availability,pob,date});
    }
    private boolean isMetricField(String s){return "inputs".equals(s)||"baskets".equals(s)||"towels".equals(s)||"conversations".equals(s)||"availability".equals(s);}

    List<Models.Doctor> routeDoctors(String date) {
        List<Models.Doctor> out=new ArrayList<>();
        String sql=doctorSelect()+" JOIN route_plan r ON r.doctor_id=d._id WHERE r.date=? ORDER BY r.order_no";
        try(Cursor c=getReadableDatabase().rawQuery(sql,new String[]{date})){while(c.moveToNext())out.add(doctorFrom(c));}return out;
    }

    void addRouteDoctor(String date,long doctorId){SQLiteDatabase db=getWritableDatabase();int order=0;try(Cursor c=db.rawQuery("SELECT COALESCE(MAX(order_no),0)+1 FROM route_plan WHERE date=?",new String[]{date})){if(c.moveToFirst())order=c.getInt(0);}ContentValues cv=new ContentValues();cv.put("date",date);cv.put("doctor_id",doctorId);cv.put("order_no",order);db.insertWithOnConflict("route_plan",null,cv,SQLiteDatabase.CONFLICT_IGNORE);}
    void removeRouteDoctor(String date,long doctorId){getWritableDatabase().delete("route_plan","date=? AND doctor_id=?",new String[]{date,String.valueOf(doctorId)});}

    Map<Long,String> lastProductStatuses(long doctorId) {
        Map<Long,String> out=new HashMap<>();
        String sql="SELECT vp.product_id,vp.status FROM visit_products vp JOIN visits v ON v._id=vp.visit_id WHERE v.doctor_id=? AND v._id=(SELECT _id FROM visits WHERE doctor_id=? ORDER BY visited_at DESC LIMIT 1)";
        try(Cursor c=getReadableDatabase().rawQuery(sql,new String[]{String.valueOf(doctorId),String.valueOf(doctorId)})){while(c.moveToNext())out.put(c.getLong(0),c.getString(1));}return out;
    }

    List<long[]> futureFollowUps() {
        List<long[]> out=new ArrayList<>();
        try(Cursor c=getReadableDatabase().rawQuery("SELECT _id,doctor_id,follow_up_at FROM visits WHERE follow_up_at>? ORDER BY follow_up_at",new String[]{String.valueOf(System.currentTimeMillis())})){while(c.moveToNext())out.add(new long[]{c.getLong(0),c.getLong(1),c.getLong(2)});}return out;
    }

    void checkpoint() { try(Cursor ignored=getWritableDatabase().rawQuery("PRAGMA wal_checkpoint(FULL)",null)) { if(ignored.moveToFirst()){} } }

    private static String clean(String s){return s==null?"":s.trim();}
}
