package com.mrfieldbook.app;

import android.app.Activity;
import android.app.TimePickerDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.os.Bundle;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.AutoCompleteTextView;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.Locale;

public class DoctorEditActivity extends Activity {
    private Db db; private long doctorId; private Models.Doctor doctor;
    private EditText name,hospital,address,notes; private AutoCompleteTextView chemist;
    private final CheckBox[] dayBoxes=new CheckBox[7]; private final String[] dayCodes={"MON","TUE","WED","THU","FRI","SAT","SUN"};
    private Button time1,time2,gps; private String t1="",t2=""; private double lat,lng;

    @Override protected void onCreate(Bundle b){super.onCreate(b);db=new Db(this);doctorId=getIntent().getLongExtra("doctor_id",0);doctor=doctorId>0?db.getDoctor(doctorId):null;build();}

    private void build(){
        LinearLayout root=Ui.vertical(this);root.setBackgroundColor(Ui.BG);
        LinearLayout head=Ui.horizontal(this);head.setPadding(Ui.dp(this,12),Ui.dp(this,12),Ui.dp(this,16),Ui.dp(this,8));Button back=Ui.ghost(this,"‹ Back");back.setOnClickListener(v->finish());head.addView(back);TextView title=Ui.title(this,doctor==null?"Add doctor":"Edit doctor");LinearLayout.LayoutParams tp=Ui.weight(1);tp.setMargins(Ui.dp(this,12),0,0,0);head.addView(title,tp);root.addView(head,Ui.matchWrap(this));
        ScrollView sv=new ScrollView(this);LinearLayout form=Ui.vertical(this);form.setPadding(Ui.dp(this,16),Ui.dp(this,8),Ui.dp(this,16),Ui.dp(this,30));sv.addView(form);root.addView(sv,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,0,1));setContentView(root);
        form.addView(Ui.label(this,"Doctor name"));name=Ui.edit(this,"Dr name");form.addView(name,Ui.matchWrap(this));Ui.spacer(form,12);
        form.addView(Ui.label(this,"Hospital / clinic"));hospital=Ui.edit(this,"Hospital or clinic name");form.addView(hospital,Ui.matchWrap(this));Ui.spacer(form,12);
        form.addView(Ui.label(this,"Address"));address=Ui.notes(this,"Doctor/hospital address");form.addView(address,Ui.matchWrap(this));Ui.spacer(form,12);
        form.addView(Ui.label(this,"Linked chemist"));chemist=new AutoCompleteTextView(this);chemist.setHint("Type chemist name");chemist.setTextSize(16);chemist.setSingleLine(true);chemist.setPadding(Ui.dp(this,14),0,Ui.dp(this,14),0);chemist.setBackground(Ui.round(this,android.graphics.Color.WHITE,Ui.BORDER,12));chemist.setMinHeight(Ui.dp(this,52));List<Models.Chemist> cs=db.searchChemists("",500);List<String> names=new ArrayList<>();for(Models.Chemist c:cs)names.add(c.name);chemist.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_dropdown_item_1line,names));chemist.setThreshold(1);form.addView(chemist,Ui.matchWrap(this));Ui.spacer(form,16);
        form.addView(Ui.section(this,"Meeting days & timings"));LinearLayout days=Ui.horizontal(this);days.setWeightSum(7);for(int i=0;i<7;i++){CheckBox c=new CheckBox(this);c.setText(dayCodes[i].substring(0,1));c.setButtonTintList(android.content.res.ColorStateList.valueOf(Ui.BRAND));dayBoxes[i]=c;days.addView(c,new LinearLayout.LayoutParams(0,ViewGroup.LayoutParams.WRAP_CONTENT,1));}form.addView(days,Ui.matchWrap(this));
        LinearLayout times=Ui.horizontal(this);time1=Ui.secondary(this,"First time");time2=Ui.secondary(this,"Second time");times.addView(time1,Ui.weight(1));LinearLayout.LayoutParams p2=Ui.weight(1);p2.setMargins(Ui.dp(this,8),0,0,0);times.addView(time2,p2);form.addView(times,Ui.matchWrap(this));time1.setOnClickListener(v->pickTime(true));time2.setOnClickListener(v->pickTime(false));Ui.spacer(form,16);
        gps=Ui.secondary(this,"Use current GPS for doctor");gps.setOnClickListener(v->fetchGps());form.addView(gps,Ui.matchWrap(this));Ui.spacer(form,12);
        form.addView(Ui.label(this,"Notes"));notes=Ui.notes(this,"Optional notes");form.addView(notes,Ui.matchWrap(this));Ui.spacer(form,18);
        Button save=Ui.button(this,"Save doctor");save.setOnClickListener(v->save());form.addView(save,Ui.matchWrap(this));
        if(doctor!=null)fill();
    }

    private void fill(){name.setText(doctor.name);hospital.setText(doctor.hospital);address.setText(doctor.address);chemist.setText(doctor.chemistName,false);notes.setText(doctor.notes);lat=doctor.latitude;lng=doctor.longitude;t1=doctor.meetingTime1;t2=doctor.meetingTime2;updateTimes();String ds=doctor.meetingDays==null?"":doctor.meetingDays;for(int i=0;i<dayCodes.length;i++)dayBoxes[i].setChecked(ds.contains(dayCodes[i]));if(lat!=0||lng!=0)gps.setText(String.format(Locale.US,"GPS saved: %.5f, %.5f",lat,lng));}
    private void pickTime(boolean first){Calendar c=Calendar.getInstance();String current=first?t1:t2;if(current!=null&&current.contains(":")){try{String[] x=current.split(":");c.set(Calendar.HOUR_OF_DAY,Integer.parseInt(x[0]));c.set(Calendar.MINUTE,Integer.parseInt(x[1]));}catch(Exception ignored){}}new TimePickerDialog(this,(v,h,m)->{String s=String.format(Locale.US,"%02d:%02d",h,m);if(first)t1=s;else t2=s;updateTimes();},c.get(Calendar.HOUR_OF_DAY),c.get(Calendar.MINUTE),false).show();}
    private void updateTimes(){time1.setText(t1.isEmpty()?"First time":Models.formatTime(t1));time2.setText(t2.isEmpty()?"Second time":Models.formatTime(t2));}
    private void fetchGps(){gps.setText("Fetching GPS…");LocationHelper.fetch(this,new LocationHelper.Callback(){public void onLocation(Location l){lat=l.getLatitude();lng=l.getLongitude();gps.setText(String.format(Locale.US,"GPS: %.5f, %.5f",lat,lng));}public void onError(String m){gps.setText("Use current GPS for doctor");Ui.toast(DoctorEditActivity.this,m);}});}
    private void save(){String n=name.getText().toString().trim();if(n.isEmpty()){name.setError("Doctor name required");return;}long chemistId=0;String cn=chemist.getText().toString().trim();if(!cn.isEmpty()){List<Models.Chemist> list=db.searchChemists(cn,50);for(Models.Chemist c:list)if(Db.normalize(c.name).equals(Db.normalize(cn))){chemistId=c.id;break;}if(chemistId==0)chemistId=db.upsertChemist(cn,"",0,0,"");}StringBuilder ds=new StringBuilder();for(int i=0;i<dayBoxes.length;i++)if(dayBoxes[i].isChecked()){if(ds.length()>0)ds.append(',');ds.append(dayCodes[i]);}long id=db.upsertDoctor(doctorId,n,hospital.getText().toString(),address.getText().toString(),chemistId,ds.toString(),t1,t2,lat,lng,notes.getText().toString());Intent data=new Intent();data.putExtra("doctor_id",id);setResult(RESULT_OK,data);Ui.toast(this,"Doctor saved");finish();}
    @Override public void onRequestPermissionsResult(int r,String[] p,int[] g){super.onRequestPermissionsResult(r,p,g);if(r==LocationHelper.REQUEST_LOCATION&&g.length>0&&g[0]==PackageManager.PERMISSION_GRANTED)fetchGps();}
}
