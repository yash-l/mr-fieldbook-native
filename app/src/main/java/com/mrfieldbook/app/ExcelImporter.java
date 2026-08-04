package com.mrfieldbook.app;

import android.content.Context;
import android.net.Uri;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

import javax.xml.parsers.DocumentBuilderFactory;

final class ExcelImporter {
    static final class Result { int doctors; int chemists; int updated; int skipped; String message(){return "Imported "+doctors+" doctors, "+chemists+" chemists; updated/merged "+updated+", skipped "+skipped;} }
    private ExcelImporter() {}

    static Result importUri(Context context, Db db, Uri uri) throws Exception {
        String name=FileUtils.displayName(context,uri).toLowerCase(Locale.ROOT);
        try(InputStream in=context.getContentResolver().openInputStream(uri)){
            if(in==null)throw new IllegalArgumentException("Cannot open file");
            if(name.endsWith(".csv"))return importRows(db,readCsv(in));
            if(name.endsWith(".xlsx")){
                File tmp=File.createTempFile("mr-import-",".xlsx",context.getCacheDir());
                try(FileOutputStream out=new FileOutputStream(tmp)){byte[] b=new byte[32768];int n;while((n=in.read(b))>0)out.write(b,0,n);}
                try{return importRows(db,readXlsx(tmp));}finally{tmp.delete();}
            }
            if(name.endsWith(".xls"))throw new IllegalArgumentException("Old .xls format: open it in Google Sheets/Excel and Save As .xlsx, then import.");
            throw new IllegalArgumentException("Choose an .xlsx or .csv file");
        }
    }

    private static Result importRows(Db db,List<List<String>> rows){
        Result r=new Result();if(rows.isEmpty())return r;
        int headerIndex=findHeader(rows);if(headerIndex<0)throw new IllegalArgumentException("Doctor/DR Name column not found");
        Map<String,Integer> h=headers(rows.get(headerIndex));
        for(int i=headerIndex+1;i<rows.size();i++){
            List<String> row=rows.get(i);String doctor=cell(row,h,"doctor","drname","doctorname","nameofthedoctor","nameofdoctor","doctorfullname","listeddoctorname","prescriber","dr");
            String chemist=cell(row,h,"chemist","chemistname","linkedchemist","pharmacy","retailer");
            if(doctor.isEmpty()&&chemist.isEmpty()){r.skipped++;continue;}
            long chemistId=0;
            if(!chemist.isEmpty()){
                String ca=cell(row,h,"chemistaddress","pharmacyaddress","chemistarea");
                chemistId=db.upsertChemist(chemist,ca,0,0,"");r.chemists++;
            }
            if(!doctor.isEmpty()){
                String hospital=cell(row,h,"hospital","hospitalname","clinic","clinicname","institution","nursinghome");
                String address=cell(row,h,"address","draddress","doctoraddress","place","area","location");
                String days=normalDays(cell(row,h,"meetingdays","days","visitdays","availabilitydays"));
                String t1=normalTime(cell(row,h,"meetingtime","meetingtime1","time","timing","visittime"));
                String t2=normalTime(cell(row,h,"meetingtime2","secondtime","eveningtime"));
                String notes=cell(row,h,"notes","remark","remarks","speciality","specialty");
                List<Models.Doctor> before=db.searchDoctors(doctor,50);Models.Doctor existing=null;for(Models.Doctor d:before)if(Db.normalize(d.name).equals(Db.normalize(doctor))&&Db.normalize(d.hospital).equals(Db.normalize(hospital))){existing=d;break;}
                if(existing!=null){
                    if(address.isEmpty())address=existing.address;
                    if(chemistId==0)chemistId=existing.chemistId;
                    if(days.isEmpty())days=existing.meetingDays;
                    if(t1.isEmpty())t1=existing.meetingTime1;
                    if(t2.isEmpty())t2=existing.meetingTime2;
                    if(notes.isEmpty())notes=existing.notes;else if(!existing.notes.isEmpty()&&!existing.notes.equals(notes))notes=existing.notes+"\n"+notes;
                    db.upsertDoctor(existing.id,doctor,hospital,address,chemistId,days,t1,t2,existing.latitude,existing.longitude,notes);r.updated++;
                }else{db.upsertDoctor(0,doctor,hospital,address,chemistId,days,t1,t2,0,0,notes);r.doctors++;}
            }
        }return r;
    }

    private static int findHeader(List<List<String>> rows){for(int i=0;i<Math.min(rows.size(),30);i++){for(String s:rows.get(i)){String n=key(s);if(n.equals("drname")||n.equals("doctorname")||n.equals("nameofthedoctor")||n.equals("nameofdoctor")||n.equals("doctorfullname")||n.equals("listeddoctorname")||n.equals("prescriber"))return i;}}return -1;}
    private static Map<String,Integer> headers(List<String> row){Map<String,Integer> m=new HashMap<>();for(int i=0;i<row.size();i++){String k=key(row.get(i));if(!k.isEmpty()&&!m.containsKey(k))m.put(k,i);}return m;}
    private static String cell(List<String> row,Map<String,Integer> h,String... keys){for(String k:keys){Integer i=h.get(k);if(i!=null&&i<row.size()){String s=row.get(i)==null?"":row.get(i).trim();if(!s.isEmpty())return s;}}return "";}
    private static String key(String s){return s==null?"":s.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]","");}
    private static String normalDays(String s){if(s==null)return "";String u=s.toUpperCase(Locale.US);String[] names={"MON","TUE","WED","THU","FRI","SAT","SUN"};StringBuilder b=new StringBuilder();for(String n:names)if(u.contains(n)){if(b.length()>0)b.append(',');b.append(n);}return b.toString();}
    private static String normalTime(String s){if(s==null||s.trim().isEmpty())return "";s=s.trim();try{if(s.matches("0?\\.\\d+")){double f=Double.parseDouble(s);int min=(int)Math.round(f*24*60)%1440;return String.format(Locale.US,"%02d:%02d",min/60,min%60);}java.text.DateFormat[] fs={new java.text.SimpleDateFormat("H:mm",Locale.US),new java.text.SimpleDateFormat("h:mm a",Locale.US),new java.text.SimpleDateFormat("h a",Locale.US)};for(java.text.DateFormat f:fs){f.setLenient(false);try{return new java.text.SimpleDateFormat("HH:mm",Locale.US).format(f.parse(s));}catch(Exception ignored){}}}catch(Exception ignored){}return s;}

    private static List<List<String>> readCsv(InputStream in)throws Exception{
        List<List<String>> rows=new ArrayList<>();BufferedReader br=new BufferedReader(new InputStreamReader(in,StandardCharsets.UTF_8));String line;while((line=br.readLine())!=null)rows.add(parseCsvLine(line));return rows;
    }
    private static List<String> parseCsvLine(String line){List<String> out=new ArrayList<>();StringBuilder b=new StringBuilder();boolean q=false;for(int i=0;i<line.length();i++){char c=line.charAt(i);if(c=='"'){if(q&&i+1<line.length()&&line.charAt(i+1)=='"'){b.append('"');i++;}else q=!q;}else if(c==','&&!q){out.add(b.toString());b.setLength(0);}else b.append(c);}out.add(b.toString());return out;}

    private static List<List<String>> readXlsx(File file)throws Exception{
        List<List<String>> all=new ArrayList<>();try(ZipFile zip=new ZipFile(file)){
            List<String> shared=readShared(zip);
            for(int sheet=1;sheet<=50;sheet++){
                ZipEntry e=zip.getEntry("xl/worksheets/sheet"+sheet+".xml");if(e==null){if(sheet>5)break;else continue;}
                Document d=parse(zip.getInputStream(e));NodeList rowNodes=d.getElementsByTagName("row");
                for(int r=0;r<rowNodes.getLength();r++){
                    Element re=(Element)rowNodes.item(r);NodeList cells=re.getElementsByTagName("c");List<String> row=new ArrayList<>();
                    for(int ci=0;ci<cells.getLength();ci++){
                        Element ce=(Element)cells.item(ci);int col=columnIndex(ce.getAttribute("r"));while(row.size()<=col)row.add("");String type=ce.getAttribute("t");String value="";
                        if("inlineStr".equals(type)){NodeList ts=ce.getElementsByTagName("t");StringBuilder b=new StringBuilder();for(int k=0;k<ts.getLength();k++)b.append(ts.item(k).getTextContent());value=b.toString();}
                        else{NodeList vs=ce.getElementsByTagName("v");if(vs.getLength()>0)value=vs.item(0).getTextContent();if("s".equals(type)){try{value=shared.get(Integer.parseInt(value));}catch(Exception ignored){}}}
                        row.set(col,value==null?"":value);
                    }all.add(row);
                }
            }
        }return all;
    }
    private static List<String> readShared(ZipFile zip)throws Exception{List<String> out=new ArrayList<>();ZipEntry e=zip.getEntry("xl/sharedStrings.xml");if(e==null)return out;Document d=parse(zip.getInputStream(e));NodeList sis=d.getElementsByTagName("si");for(int i=0;i<sis.getLength();i++){NodeList ts=((Element)sis.item(i)).getElementsByTagName("t");StringBuilder b=new StringBuilder();for(int k=0;k<ts.getLength();k++)b.append(ts.item(k).getTextContent());out.add(b.toString());}return out;}
    private static Document parse(InputStream in)throws Exception{DocumentBuilderFactory f=DocumentBuilderFactory.newInstance();f.setNamespaceAware(false);try{f.setFeature("http://apache.org/xml/features/disallow-doctype-decl",true);}catch(Exception ignored){}try{f.setFeature("http://xml.org/sax/features/external-general-entities",false);}catch(Exception ignored){}try{f.setFeature("http://xml.org/sax/features/external-parameter-entities",false);}catch(Exception ignored){}try{f.setXIncludeAware(false);}catch(Exception ignored){}f.setExpandEntityReferences(false);return f.newDocumentBuilder().parse(in);}
    private static int columnIndex(String ref){int n=0;for(int i=0;i<ref.length();i++){char c=ref.charAt(i);if(c>='A'&&c<='Z')n=n*26+(c-'A'+1);else if(c>='a'&&c<='z')n=n*26+(c-'a'+1);else break;}return Math.max(0,n-1);}
}
