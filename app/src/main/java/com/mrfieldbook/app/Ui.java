package com.mrfieldbook.app;

import android.app.Activity;
import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

final class Ui {
    static final int BRAND = Color.rgb(79,70,229);
    static final int BRAND_DARK = Color.rgb(55,48,163);
    static final int BG = Color.rgb(247,247,251);
    static final int TEXT = Color.rgb(23,23,36);
    static final int MUTED = Color.rgb(101,101,122);
    static final int BORDER = Color.rgb(226,226,235);
    static final int SUCCESS = Color.rgb(8,126,87);
    static final int DANGER = Color.rgb(180,35,24);

    private Ui() {}
    static int dp(Context c, float v) { return Math.round(v * c.getResources().getDisplayMetrics().density); }

    static LinearLayout vertical(Context c) { LinearLayout l=new LinearLayout(c);l.setOrientation(LinearLayout.VERTICAL);return l; }
    static LinearLayout horizontal(Context c) { LinearLayout l=new LinearLayout(c);l.setOrientation(LinearLayout.HORIZONTAL);l.setGravity(Gravity.CENTER_VERTICAL);return l; }

    static TextView text(Context c, String value, float sp, int color) {
        TextView t=new TextView(c);t.setText(value);t.setTextSize(sp);t.setTextColor(color);t.setLineSpacing(0,1.08f);return t;
    }
    static TextView title(Context c, String value) { TextView t=text(c,value,22,TEXT);t.setTypeface(Typeface.DEFAULT,Typeface.BOLD);return t; }
    static TextView section(Context c, String value) { TextView t=text(c,value,17,TEXT);t.setTypeface(Typeface.DEFAULT,Typeface.BOLD);t.setPadding(0,dp(c,12),0,dp(c,8));return t; }
    static TextView label(Context c, String value) { TextView t=text(c,value,12,MUTED);t.setTypeface(Typeface.DEFAULT,Typeface.BOLD);t.setAllCaps(true);t.setLetterSpacing(.05f);return t; }

    static EditText edit(Context c, String hint) {
        EditText e=new EditText(c);e.setHint(hint);e.setTextSize(16);e.setTextColor(TEXT);e.setHintTextColor(Color.rgb(150,150,165));e.setSingleLine(true);e.setPadding(dp(c,14),0,dp(c,14),0);e.setBackground(round(c,Color.WHITE,BORDER,12));e.setMinHeight(dp(c,52));return e;
    }
    static EditText number(Context c,String hint){EditText e=edit(c,hint);e.setInputType(InputType.TYPE_CLASS_NUMBER|InputType.TYPE_NUMBER_FLAG_DECIMAL);return e;}
    static EditText notes(Context c,String hint){EditText e=edit(c,hint);e.setSingleLine(false);e.setGravity(Gravity.TOP);e.setMinHeight(dp(c,90));e.setPadding(dp(c,14),dp(c,12),dp(c,14),dp(c,12));return e;}

    static Button button(Context c,String label){Button b=new Button(c);b.setText(label);b.setTextSize(14);b.setTextColor(Color.WHITE);b.setAllCaps(false);b.setTypeface(Typeface.DEFAULT,Typeface.BOLD);b.setBackground(round(c,BRAND,BRAND,12));b.setMinHeight(dp(c,48));b.setPadding(dp(c,14),0,dp(c,14),0);return b;}
    static Button secondary(Context c,String label){Button b=button(c,label);b.setTextColor(BRAND_DARK);b.setBackground(round(c,Color.rgb(238,238,255),Color.rgb(214,211,255),12));return b;}
    static Button ghost(Context c,String label){Button b=button(c,label);b.setTextColor(TEXT);b.setBackground(round(c,Color.WHITE,BORDER,12));return b;}
    static Button danger(Context c,String label){Button b=button(c,label);b.setTextColor(DANGER);b.setBackground(round(c,Color.rgb(255,241,240),Color.rgb(255,205,200),12));return b;}

    static LinearLayout card(Context c){LinearLayout l=vertical(c);l.setPadding(dp(c,16),dp(c,14),dp(c,16),dp(c,14));l.setBackground(round(c,Color.WHITE,BORDER,16));return l;}
    static TextView pill(Context c,String value,int color){TextView t=text(c,value,11,color);t.setTypeface(Typeface.DEFAULT,Typeface.BOLD);t.setPadding(dp(c,10),dp(c,5),dp(c,10),dp(c,5));t.setBackground(round(c,withAlpha(color,20),withAlpha(color,60),50));return t;}

    static GradientDrawable round(Context c,int fill,int stroke,float radius){GradientDrawable g=new GradientDrawable();g.setColor(fill);g.setCornerRadius(dp(c,radius));g.setStroke(dp(c,1),stroke);return g;}
    static int withAlpha(int color,int alpha){return Color.argb(alpha,Color.red(color),Color.green(color),Color.blue(color));}

    static LinearLayout.LayoutParams matchWrap(Context c){return new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT);}
    static LinearLayout.LayoutParams weight(float w){return new LinearLayout.LayoutParams(0,ViewGroup.LayoutParams.WRAP_CONTENT,w);}
    static void margin(View v,int l,int t,int r,int b){ViewGroup.LayoutParams p=v.getLayoutParams();if(p instanceof ViewGroup.MarginLayoutParams){((ViewGroup.MarginLayoutParams)p).setMargins(dp(v.getContext(),l),dp(v.getContext(),t),dp(v.getContext(),r),dp(v.getContext(),b));v.setLayoutParams(p);}}
    static void spacer(LinearLayout parent,int dp){View v=new View(parent.getContext());parent.addView(v,new LinearLayout.LayoutParams(1,Ui.dp(parent.getContext(),dp)));}

    static void toast(Context c,String message){android.widget.Toast.makeText(c,message,android.widget.Toast.LENGTH_SHORT).show();}
}
