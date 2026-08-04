package com.mrfieldbook.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

final class BackupUtils {
    static final int REQ_EXPORT=8101,REQ_RESTORE=8102;
    private BackupUtils(){}
    static void chooseExport(Activity a){Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("application/octet-stream");i.putExtra(Intent.EXTRA_TITLE,"MR-FieldBook-"+Db.todayKey()+".mrbackup");a.startActivityForResult(i,REQ_EXPORT);}
    static void chooseRestore(Activity a){Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("*/*");a.startActivityForResult(i,REQ_RESTORE);}
    static void exportDb(Context c,Db db,Uri uri)throws Exception{db.checkpoint();db.close();File f=c.getDatabasePath(Db.DB_NAME);try(InputStream in=new FileInputStream(f);OutputStream out=c.getContentResolver().openOutputStream(uri,"w")){if(out==null)throw new IllegalStateException("Cannot create backup");copy(in,out);}}
    static void restoreDb(Context c,Db db,Uri uri)throws Exception{File tmp=File.createTempFile("mr-restore-",".db",c.getCacheDir());try(InputStream in=c.getContentResolver().openInputStream(uri);OutputStream out=new FileOutputStream(tmp)){if(in==null)throw new IllegalStateException("Cannot open backup");copy(in,out);}byte[] h=new byte[16];try(InputStream in=new FileInputStream(tmp)){if(in.read(h)<16||!new String(h,StandardCharsets.US_ASCII).startsWith("SQLite format 3"))throw new IllegalArgumentException("This is not a valid MR FieldBook backup");}db.close();File target=c.getDatabasePath(Db.DB_NAME);File wal=new File(target.getPath()+"-wal"),shm=new File(target.getPath()+"-shm");wal.delete();shm.delete();try(InputStream in=new FileInputStream(tmp);OutputStream out=new FileOutputStream(target,false)){copy(in,out);}tmp.delete();}
    private static void copy(InputStream in,OutputStream out)throws Exception{byte[] b=new byte[65536];int n;while((n=in.read(b))>0)out.write(b,0,n);out.flush();}
}
