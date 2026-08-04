package com.mrfieldbook.app;

import android.Manifest;
import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.content.ClipboardManager;
import android.content.Context;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;

public final class MainActivity extends Activity {
    private static final int REQUEST_FILES = 1001;
    private static final int REQUEST_SAVE = 1002;
    private static final int REQUEST_LOCATION = 1003;

    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private GeolocationPermissions.Callback geoCallback;
    private String geoOrigin;
    private String pendingSaveName;
    private String pendingSaveMime;
    private String pendingSaveContent;
    private String pendingGpsPrefix;
    private LocationManager locationManager;
    private LocationListener activeLocationListener;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setGeolocationEnabled(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(false);

        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");
        webView.setWebViewClient(new AppWebViewClient());
        webView.setWebChromeClient(new AppWebChromeClient());
        webView.loadUrl("file:///android_asset/web/index.html");
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == REQUEST_FILES) {
            ValueCallback<Uri[]> callback = fileCallback;
            fileCallback = null;
            if (callback == null) return;
            if (resultCode != RESULT_OK || data == null) {
                callback.onReceiveValue(null);
                return;
            }

            List<Uri> uris = new ArrayList<>();
            ClipData clipData = data.getClipData();
            if (clipData != null) {
                for (int i = 0; i < clipData.getItemCount(); i++) {
                    Uri uri = clipData.getItemAt(i).getUri();
                    if (uri != null) uris.add(uri);
                }
            } else if (data.getData() != null) {
                uris.add(data.getData());
            }
            callback.onReceiveValue(uris.isEmpty() ? null : uris.toArray(new Uri[0]));
            return;
        }

        if (requestCode == REQUEST_SAVE) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                try (OutputStream out = getContentResolver().openOutputStream(data.getData())) {
                    if (out == null) throw new IllegalStateException("Cannot create file");
                    out.write(pendingSaveContent.getBytes(StandardCharsets.UTF_8));
                    out.flush();
                    Toast.makeText(this, "Saved successfully", Toast.LENGTH_SHORT).show();
                } catch (Exception error) {
                    Toast.makeText(this, "Save failed: " + error.getMessage(), Toast.LENGTH_LONG).show();
                }
            }
            pendingSaveName = null;
            pendingSaveMime = null;
            pendingSaveContent = null;
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_LOCATION) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            if (geoCallback != null) {
                geoCallback.invoke(geoOrigin, granted, false);
                geoCallback = null;
                geoOrigin = null;
            }
            if (pendingGpsPrefix != null) {
                String prefix = pendingGpsPrefix;
                pendingGpsPrefix = null;
                if (granted) startNativeLocation(prefix);
                else sendNativeLocation(prefix, null, "Location permission denied. Allow Location for this app.");
            }
        }
    }


    private void requestNativeLocation(String prefix) {
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            startNativeLocation(prefix);
        } else {
            pendingGpsPrefix = prefix;
            requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, REQUEST_LOCATION);
        }
    }

    private void startNativeLocation(String prefix) {
        try {
            locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
            if (locationManager == null) throw new IllegalStateException("Location service unavailable");
            boolean gps = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER);
            boolean network = locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
            if (!gps && !network) {
                sendNativeLocation(prefix, null, "Turn on phone Location/GPS and retry.");
                return;
            }

            if (activeLocationListener != null) locationManager.removeUpdates(activeLocationListener);
            final boolean[] completed = {false};
            activeLocationListener = new LocationListener() {
                @Override
                public void onLocationChanged(Location location) {
                    if (completed[0]) return;
                    completed[0] = true;
                    try { locationManager.removeUpdates(activeLocationListener); } catch (Exception ignored) {}
                    sendNativeLocation(prefix, location, null);
                }
            };

            if (gps) locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 0L, 0f, activeLocationListener, Looper.getMainLooper());
            if (network) locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 0L, 0f, activeLocationListener, Looper.getMainLooper());

            mainHandler.postDelayed(() -> {
                if (completed[0]) return;
                completed[0] = true;
                try { locationManager.removeUpdates(activeLocationListener); } catch (Exception ignored) {}
                Location last = null;
                try {
                    Location gpsLast = gps ? locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER) : null;
                    Location netLast = network ? locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER) : null;
                    if (gpsLast != null && netLast != null) last = gpsLast.getTime() >= netLast.getTime() ? gpsLast : netLast;
                    else last = gpsLast != null ? gpsLast : netLast;
                } catch (SecurityException ignored) {}
                if (last != null) sendNativeLocation(prefix, last, null);
                else sendNativeLocation(prefix, null, "GPS timed out. Move outdoors and tap Retry GPS.");
            }, 12000L);
        } catch (SecurityException error) {
            sendNativeLocation(prefix, null, "Location permission denied.");
        } catch (Exception error) {
            sendNativeLocation(prefix, null, error.getMessage() == null ? "GPS unavailable" : error.getMessage());
        }
    }

    private void sendNativeLocation(String prefix, Location location, String error) {
        String script;
        if (location != null) {
            script = "window.__mrNativeLocation(" + org.json.JSONObject.quote(prefix) + ",true," +
                    location.getLatitude() + "," + location.getLongitude() + "," +
                    Math.round(location.hasAccuracy() ? location.getAccuracy() : 0f) + ",\"\");";
        } else {
            script = "window.__mrNativeLocation(" + org.json.JSONObject.quote(prefix) + ",false,0,0,0," +
                    org.json.JSONObject.quote(error == null ? "GPS unavailable" : error) + ");";
        }
        runOnUiThread(() -> webView.evaluateJavascript(script, null));
    }

    private void openExternal(String url) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            startActivity(intent);
        } catch (Exception error) {
            Toast.makeText(this, "No app can open this link", Toast.LENGTH_SHORT).show();
        }
    }

    private final class AppWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            String scheme = uri.getScheme();
            if ("file".equalsIgnoreCase(scheme) || "about".equalsIgnoreCase(scheme)) return false;
            openExternal(uri.toString());
            return true;
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            if (url.startsWith("file:") || url.startsWith("about:")) return false;
            openExternal(url);
            return true;
        }
    }

    private final class AppWebChromeClient extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = callback;

            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("*/*");
            intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "application/vnd.ms-excel",
                    "text/csv",
                    "application/json",
                    "text/plain"
            });
            startActivityForResult(intent, REQUEST_FILES);
            return true;
        }

        @Override
        public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
            if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                callback.invoke(origin, true, false);
            } else {
                geoOrigin = origin;
                geoCallback = callback;
                requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, REQUEST_LOCATION);
            }
        }
    }

    public final class AndroidBridge {
        @JavascriptInterface
        public boolean isNativeApp() {
            return true;
        }

        @JavascriptInterface
        public void fetchLocation(String prefix) {
            runOnUiThread(() -> requestNativeLocation(prefix == null ? "meeting" : prefix));
        }

        @JavascriptInterface
        public String sha256(String value) {
            try {
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                byte[] bytes = digest.digest((value == null ? "" : value).getBytes(StandardCharsets.UTF_8));
                StringBuilder hex = new StringBuilder();
                for (byte item : bytes) hex.append(String.format(java.util.Locale.US, "%02x", item & 0xff));
                return hex.toString();
            } catch (Exception error) {
                return "";
            }
        }

        @JavascriptInterface
        public void copyText(String text) {
            runOnUiThread(() -> {
                ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                if (clipboard != null) {
                    clipboard.setPrimaryClip(android.content.ClipData.newPlainText("MR Daily Report", text == null ? "" : text));
                    Toast.makeText(MainActivity.this, "Daily report copied", Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public String parseSpreadsheet(String fileName, String base64Data) {
            try {
                return SpreadsheetParser.parse(MainActivity.this, fileName, base64Data);
            } catch (Exception error) {
                return "{\"error\":" + SpreadsheetParser.quote(error.getMessage() == null ? "Import failed" : error.getMessage()) + "}";
            }
        }

        @JavascriptInterface
        public void saveTextFile(String fileName, String mimeType, String content) {
            runOnUiThread(() -> {
                pendingSaveName = fileName == null || fileName.trim().isEmpty() ? "MR-Daily-Auto-Backup.json" : fileName;
                pendingSaveMime = mimeType == null || mimeType.trim().isEmpty() ? "text/plain" : mimeType;
                pendingSaveContent = content == null ? "" : content;

                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType(pendingSaveMime);
                intent.putExtra(Intent.EXTRA_TITLE, pendingSaveName);
                startActivityForResult(intent, REQUEST_SAVE);
            });
        }

        @JavascriptInterface
        public void shareText(String title, String text) {
            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_SEND);
                intent.setType("text/plain");
                intent.putExtra(Intent.EXTRA_SUBJECT, title == null ? "MR Daily Report" : title);
                intent.putExtra(Intent.EXTRA_TEXT, text == null ? "" : text);
                startActivity(Intent.createChooser(intent, "Share daily report"));
            });
        }

        @JavascriptInterface
        public void openAppSettings() {
            runOnUiThread(() -> {
                Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()));
                startActivity(intent);
            });
        }
    }
}
