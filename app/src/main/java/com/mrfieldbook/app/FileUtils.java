package com.mrfieldbook.app;
import android.content.Context;import android.database.Cursor;import android.net.Uri;import android.provider.OpenableColumns;
final class FileUtils {private FileUtils(){} static String displayName(Context c,Uri u){try(Cursor x=c.getContentResolver().query(u,new String[]{OpenableColumns.DISPLAY_NAME},null,null,null)){if(x!=null&&x.moveToFirst())return x.getString(0);}catch(Exception ignored){}return u.getLastPathSegment()==null?"":u.getLastPathSegment();}}
