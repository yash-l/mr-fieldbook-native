package com.mrfieldbook.app;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

final class LocationHelper {
    static final int REQUEST_LOCATION = 7001;
    interface Callback { void onLocation(Location location); void onError(String message); }
    private LocationHelper() {}

    static boolean hasPermission(Activity a) {
        return a.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED || a.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED;
    }

    static void requestPermission(Activity a) {
        a.requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION},REQUEST_LOCATION);
    }

    static void fetch(Activity a, Callback callback) {
        if (!hasPermission(a)) { requestPermission(a); callback.onError("Allow location, then tap GPS again"); return; }
        LocationManager lm=(LocationManager)a.getSystemService(Context.LOCATION_SERVICE);
        if(lm==null){callback.onError("Location service unavailable");return;}
        final boolean[] done={false};
        final LocationListener listener=new LocationListener(){
            @Override public void onLocationChanged(Location location){if(done[0])return;done[0]=true;try{lm.removeUpdates(this);}catch(Exception ignored){}callback.onLocation(location);}
            @Override public void onStatusChanged(String provider,int status,Bundle extras){}
            @Override public void onProviderEnabled(String provider){}
            @Override public void onProviderDisabled(String provider){}
        };
        try {
            if(lm.isProviderEnabled(LocationManager.GPS_PROVIDER))lm.requestLocationUpdates(LocationManager.GPS_PROVIDER,0,0,listener,Looper.getMainLooper());
            if(lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER))lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER,0,0,listener,Looper.getMainLooper());
        } catch(SecurityException e){callback.onError("Location permission denied");return;}
        new Handler(Looper.getMainLooper()).postDelayed(()->{
            if(done[0])return;
            Location best=null;
            try {
                Location g=lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);Location n=lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
                if(g!=null)best=g;if(n!=null&&(best==null||n.getTime()>best.getTime()))best=n;
                lm.removeUpdates(listener);
            }catch(Exception ignored){}
            done[0]=true;
            if(best!=null)callback.onLocation(best);else callback.onError("GPS not found. Turn on Location and try again");
        },12000);
    }
}
