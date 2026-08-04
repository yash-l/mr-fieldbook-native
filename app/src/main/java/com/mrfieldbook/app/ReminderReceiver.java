package com.mrfieldbook.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;

public class ReminderReceiver extends BroadcastReceiver {
    static final String CHANNEL="mr_followups";
    @Override public void onReceive(Context context, Intent intent) {
        long doctorId=intent.getLongExtra("doctor_id",0);Db db=new Db(context);Models.Doctor d=db.getDoctor(doctorId);if(d==null)return;
        NotificationManager nm=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);if(nm==null)return;
        NotificationChannel ch=new NotificationChannel(CHANNEL,"Doctor follow-ups",NotificationManager.IMPORTANCE_HIGH);ch.setDescription("MR doctor follow-up reminders");ch.enableLights(true);ch.setLightColor(Color.BLUE);nm.createNotificationChannel(ch);
        Intent open=new Intent(context,MainActivity.class);open.putExtra("doctor_id",doctorId);open.putExtra("open_log",true);open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi=PendingIntent.getActivity(context,(int)(doctorId%Integer.MAX_VALUE),open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        android.app.Notification n=new android.app.Notification.Builder(context,CHANNEL).setSmallIcon(android.R.drawable.ic_popup_reminder).setContentTitle("Follow up: "+d.title()).setContentText(d.chemistName.isEmpty()?d.address:"Linked chemist: "+d.chemistName).setContentIntent(pi).setAutoCancel(true).build();
        nm.notify((int)(doctorId%Integer.MAX_VALUE),n);
    }
}
