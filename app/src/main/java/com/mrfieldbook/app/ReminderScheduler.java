package com.mrfieldbook.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;

final class ReminderScheduler {
    private ReminderScheduler() {}
    static void schedule(Context c,long visitId,long doctorId,long when){
        if(when<=System.currentTimeMillis())return;AlarmManager am=(AlarmManager)c.getSystemService(Context.ALARM_SERVICE);if(am==null)return;
        Intent i=new Intent(c,ReminderReceiver.class);i.putExtra("doctor_id",doctorId);i.putExtra("visit_id",visitId);
        PendingIntent pi=PendingIntent.getBroadcast(c,(int)(visitId%Integer.MAX_VALUE),i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,when,pi);
    }
    static void rescheduleAll(Context c){Db db=new Db(c);for(long[] x:db.futureFollowUps())schedule(c,x[0],x[1],x[2]);}
}
