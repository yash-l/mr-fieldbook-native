package com.mrone.fieldapp;

import android.Manifest;
import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ApplicationInfo;
import android.net.Uri;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.os.Bundle;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.content.ClipboardManager;
import android.content.SharedPreferences;
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

import com.google.android.gms.maps.model.LatLng;
import com.google.android.libraries.places.api.Places;
import com.google.android.libraries.places.api.model.CircularBounds;
import com.google.android.libraries.places.api.model.OpeningHours;
import com.google.android.libraries.places.api.model.Place;
import com.google.android.libraries.places.api.net.PlacesClient;
import com.google.android.libraries.places.api.net.SearchNearbyRequest;
import com.google.android.libraries.places.api.net.SearchByTextRequest;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public final class MainActivity extends Activity {
    private static final int REQUEST_FILES = 1001;
    private static final int REQUEST_SAVE = 1002;
    private static final int REQUEST_LOCATION = 1003;
    private static final int REQUEST_AUDIO = 1004;

    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private GeolocationPermissions.Callback geoCallback;
    private String geoOrigin;
    private String pendingSaveName;
    private String pendingSaveMime;
    private String pendingSaveContent;
    private byte[] pendingSaveBytes;
    private String pendingGpsPrefix;
    private LocationManager locationManager;
    private LocationListener activeLocationListener;
    private SpeechRecognizer speechRecognizer;
    private Intent speechIntent;
    private boolean keepListening;
    private boolean restartingSpeech;
    private String voicePrefix = "voice";
    private PlacesClient placesClient;
    private String placesInitError = "Google Places API key is not configured.";
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private boolean webReady;
    private long lastBackPressedAt;
    private static final long EXIT_BACK_WINDOW_MS = 1800L;

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

        initializePlacesClient();

        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");
        webView.setWebViewClient(new AppWebViewClient());
        webView.setWebChromeClient(new AppWebChromeClient());
        webView.loadUrl("file:///android_asset/web/index.html");
    }

    @Override
    protected void onResume() {
        super.onResume();
        mainHandler.postDelayed(this::deliverPendingSanText, 450L);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        mainHandler.postDelayed(this::deliverPendingSanText, 350L);
    }

    private void deliverPendingSanText() {
        if (!webReady || webView == null) return;
        SharedPreferences prefs = getSharedPreferences(SanOverlayService.PREFS, MODE_PRIVATE);
        String text = prefs.getString(SanOverlayService.KEY_PENDING_TEXT, "");
        if (text == null || text.trim().isEmpty()) return;
        prefs.edit().remove(SanOverlayService.KEY_PENDING_TEXT).apply();
        String script = "if(window.__mrSanOverlayText){window.__mrSanOverlayText(" + JSONObject.quote(text) + ");}";
        webView.evaluateJavascript(script, null);
    }

    private String readClipboardText() {
        try {
            ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            ClipData clip = clipboard == null ? null : clipboard.getPrimaryClip();
            if (clip == null || clip.getItemCount() == 0) return "";
            CharSequence text = clip.getItemAt(0).coerceToText(this);
            return text == null ? "" : text.toString().trim();
        } catch (Exception ignored) {
            return "";
        }
    }

    private void hapticFeedback(String kind) {
        long duration = "strong".equalsIgnoreCase(kind) ? 38L : 18L;
        try {
            Vibrator vibrator;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager manager = (VibratorManager) getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                vibrator = manager == null ? null : manager.getDefaultVibrator();
            } else {
                vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            }
            if (vibrator == null || !vibrator.hasVibrator()) return;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE));
            } else {
                vibrator.vibrate(duration);
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onBackPressed() {
        if (webView == null) {
            handleDoubleBackExit();
            return;
        }

        String script = "(function(){try{return window.__mrHandleBack?window.__mrHandleBack():'exit';}catch(e){return 'exit';}})();";
        webView.evaluateJavascript(script, value -> runOnUiThread(() -> {
            String result = value == null ? "" : value.replace("\"", "").trim();
            if ("handled".equalsIgnoreCase(result)) {
                lastBackPressedAt = 0L;
                return;
            }
            handleDoubleBackExit();
        }));
    }

    private void handleDoubleBackExit() {
        long now = System.currentTimeMillis();
        if (now - lastBackPressedAt <= EXIT_BACK_WINDOW_MS) {
            finish();
            return;
        }
        lastBackPressedAt = now;
        Toast.makeText(this, "Press back again to exit", Toast.LENGTH_SHORT).show();
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
                    if (pendingSaveBytes != null) out.write(pendingSaveBytes);
                    else out.write((pendingSaveContent == null ? "" : pendingSaveContent).getBytes(StandardCharsets.UTF_8));
                    out.flush();
                    Toast.makeText(this, "Saved successfully", Toast.LENGTH_SHORT).show();
                } catch (Exception error) {
                    Toast.makeText(this, "Save failed: " + error.getMessage(), Toast.LENGTH_LONG).show();
                }
            }
            pendingSaveName = null;
            pendingSaveMime = null;
            pendingSaveContent = null;
            pendingSaveBytes = null;
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
            return;
        }
        if (requestCode == REQUEST_AUDIO) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            if (granted) startVoiceRecognition(voicePrefix);
            else sendVoiceEvent(voicePrefix, "error", "", false, "Microphone permission denied. Allow microphone access in app settings.");
        }
    }

    private void initializePlacesClient() {
        try {
            ApplicationInfo appInfo = getPackageManager().getApplicationInfo(getPackageName(), PackageManager.GET_META_DATA);
            String apiKey = appInfo.metaData == null ? "" : appInfo.metaData.getString("com.google.android.geo.API_KEY", "");
            if (apiKey == null || apiKey.trim().isEmpty() || "NO_KEY".equals(apiKey)) {
                placesInitError = "Live search is not configured. Add the PLACES_API_KEY GitHub secret, then rebuild.";
                return;
            }
            if (!Places.isInitialized()) Places.initializeWithNewPlacesApiEnabled(getApplicationContext(), apiKey.trim());
            placesClient = Places.createClient(this);
            placesInitError = "";
        } catch (Exception error) {
            placesClient = null;
            placesInitError = error.getMessage() == null ? "Google Places could not start." : error.getMessage();
        }
    }

    private void searchNearbyHospitals(String prefix, double latitude, double longitude, double radiusMeters) {
        if (placesClient == null) {
            sendNearbyPlaces(prefix, null, placesInitError);
            return;
        }
        try {
            double safeRadius = Math.max(100d, Math.min(50000d, radiusMeters));
            List<Place.Field> fields = Arrays.asList(
                    Place.Field.ID,
                    Place.Field.DISPLAY_NAME,
                    Place.Field.FORMATTED_ADDRESS,
                    Place.Field.LOCATION,
                    Place.Field.PRIMARY_TYPE,
                    Place.Field.OPENING_HOURS
            );
            CircularBounds circle = CircularBounds.newInstance(new LatLng(latitude, longitude), safeRadius);
            SearchNearbyRequest request = SearchNearbyRequest.builder(circle, fields)
                    .setIncludedTypes(Arrays.asList("hospital", "medical_clinic", "doctor"))
                    .setMaxResultCount(20)
                    .setRankPreference(SearchNearbyRequest.RankPreference.DISTANCE)
                    .setRegionCode("IN")
                    .build();
            placesClient.searchNearby(request)
                    .addOnSuccessListener(response -> sendNearbyPlaces(prefix, response.getPlaces(), null))
                    .addOnFailureListener(error -> sendNearbyPlaces(prefix, null,
                            error.getMessage() == null ? "Nearby hospital search failed." : error.getMessage()));
        } catch (Exception error) {
            sendNearbyPlaces(prefix, null, error.getMessage() == null ? "Nearby hospital search failed." : error.getMessage());
        }
    }

    private void sendNearbyPlaces(String prefix, List<Place> places, String error) {
        JSONArray rows = new JSONArray();
        if (places != null) {
            for (Place place : places) {
                try {
                    JSONObject row = new JSONObject();
                    row.put("placeId", place.getId() == null ? "" : place.getId());
                    row.put("name", place.getDisplayName() == null ? "Hospital / clinic" : place.getDisplayName());
                    row.put("address", place.getFormattedAddress() == null ? "" : place.getFormattedAddress());
                    row.put("primaryType", place.getPrimaryType() == null ? "" : place.getPrimaryType());
                    LatLng location = place.getLocation();
                    if (location != null) {
                        row.put("latitude", location.latitude);
                        row.put("longitude", location.longitude);
                    }
                    JSONArray hours = new JSONArray();
                    OpeningHours openingHours = place.getOpeningHours();
                    if (openingHours != null && openingHours.getWeekdayText() != null) {
                        for (String line : openingHours.getWeekdayText()) hours.put(line);
                    }
                    row.put("openingHours", hours);
                    rows.put(row);
                } catch (Exception ignored) {}
            }
        }
        String script = "window.__mrNearbyPlaces(" +
                JSONObject.quote(prefix == null ? "nearby" : prefix) + "," +
                (error == null ? "true" : "false") + "," +
                JSONObject.quote(rows.toString()) + "," +
                JSONObject.quote(error == null ? "" : error) + ");";
        runOnUiThread(() -> webView.evaluateJavascript(script, null));
    }

    private void searchDoctorPlaces(String prefix, String query) {
        if (placesClient == null) {
            sendDoctorPlaces(prefix, null, placesInitError);
            return;
        }
        String safeQuery = query == null ? "" : query.trim();
        if (safeQuery.isEmpty()) {
            sendDoctorPlaces(prefix, null, "Doctor / clinic address is empty.");
            return;
        }
        try {
            List<Place.Field> fields = Arrays.asList(
                    Place.Field.ID,
                    Place.Field.DISPLAY_NAME,
                    Place.Field.FORMATTED_ADDRESS,
                    Place.Field.LOCATION,
                    Place.Field.PRIMARY_TYPE
            );
            SearchByTextRequest request = SearchByTextRequest.builder(safeQuery, fields)
                    .setMaxResultCount(5)
                    .setRegionCode("IN")
                    .build();
            placesClient.searchByText(request)
                    .addOnSuccessListener(response -> sendDoctorPlaces(prefix, response.getPlaces(), null))
                    .addOnFailureListener(error -> sendDoctorPlaces(prefix, null,
                            error.getMessage() == null ? "Online doctor GPS search failed." : error.getMessage()));
        } catch (Exception error) {
            sendDoctorPlaces(prefix, null, error.getMessage() == null ? "Online doctor GPS search failed." : error.getMessage());
        }
    }

    private void sendDoctorPlaces(String prefix, List<Place> places, String error) {
        JSONArray rows = new JSONArray();
        if (places != null) {
            for (Place place : places) {
                try {
                    LatLng location = place.getLocation();
                    if (location == null) continue;
                    JSONObject row = new JSONObject();
                    row.put("placeId", place.getId() == null ? "" : place.getId());
                    row.put("name", place.getDisplayName() == null ? "Clinic / hospital" : place.getDisplayName());
                    row.put("address", place.getFormattedAddress() == null ? "" : place.getFormattedAddress());
                    row.put("primaryType", place.getPrimaryType() == null ? "" : place.getPrimaryType());
                    row.put("latitude", location.latitude);
                    row.put("longitude", location.longitude);
                    rows.put(row);
                } catch (Exception ignored) {}
            }
        }
        String script = "window.__mrDoctorPlaceResults(" +
                JSONObject.quote(prefix == null ? "doctor-gps" : prefix) + "," +
                (error == null ? "true" : "false") + "," +
                JSONObject.quote(rows.toString()) + "," +
                JSONObject.quote(error == null ? "" : error) + ");";
        runOnUiThread(() -> webView.evaluateJavascript(script, null));
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

    private void requestVoiceRecognition(String prefix) {
        voicePrefix = prefix == null || prefix.trim().isEmpty() ? "voice" : prefix;
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            sendVoiceEvent(voicePrefix, "error", "", false, "Speech recognition is not available on this phone.");
            return;
        }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQUEST_AUDIO);
            return;
        }
        startVoiceRecognition(voicePrefix);
    }

    private void ensureSpeechRecognizer() {
        if (speechRecognizer != null) return;
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
        speechRecognizer.setRecognitionListener(new RecognitionListener() {
            @Override public void onReadyForSpeech(Bundle params) {
                restartingSpeech = false;
                sendVoiceEvent(voicePrefix, "listening", "", false, "");
            }
            @Override public void onBeginningOfSpeech() {
                sendVoiceEvent(voicePrefix, "speech", "", false, "");
            }
            @Override public void onRmsChanged(float rmsdB) {}
            @Override public void onBufferReceived(byte[] buffer) {}
            @Override public void onEndOfSpeech() {
                sendVoiceEvent(voicePrefix, "processing", "", false, "");
            }
            @Override public void onError(int error) {
                String message = speechErrorMessage(error);
                boolean recoverable = error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT || error == SpeechRecognizer.ERROR_CLIENT;
                if (keepListening && recoverable) {
                    restartSpeechSoon();
                } else {
                    keepListening = false;
                    sendVoiceEvent(voicePrefix, "error", "", false, message);
                }
            }
            @Override public void onResults(Bundle results) {
                ArrayList<String> matches = results == null ? null : results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                String text = matches == null || matches.isEmpty() ? "" : matches.get(0);
                if (!text.trim().isEmpty()) sendVoiceEvent(voicePrefix, "result", text, true, "");
                if (keepListening) restartSpeechSoon();
                else sendVoiceEvent(voicePrefix, "stopped", "", false, "");
            }
            @Override public void onPartialResults(Bundle partialResults) {
                ArrayList<String> matches = partialResults == null ? null : partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                String text = matches == null || matches.isEmpty() ? "" : matches.get(0);
                if (!text.trim().isEmpty()) sendVoiceEvent(voicePrefix, "partial", text, false, "");
            }
            @Override public void onEvent(int eventType, Bundle params) {}
        });

        speechIntent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        speechIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        speechIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-IN");
        speechIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "en-IN");
        speechIntent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        speechIntent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
        speechIntent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2200L);
        speechIntent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1400L);
        speechIntent.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getPackageName());
    }

    private void startVoiceRecognition(String prefix) {
        voicePrefix = prefix == null || prefix.trim().isEmpty() ? "voice" : prefix;
        try {
            ensureSpeechRecognizer();
            keepListening = true;
            restartingSpeech = false;
            speechRecognizer.cancel();
            speechRecognizer.startListening(speechIntent);
            sendVoiceEvent(voicePrefix, "starting", "", false, "");
        } catch (Exception error) {
            keepListening = false;
            sendVoiceEvent(voicePrefix, "error", "", false, error.getMessage() == null ? "Could not start microphone." : error.getMessage());
        }
    }

    private void restartSpeechSoon() {
        if (!keepListening || restartingSpeech) return;
        restartingSpeech = true;
        mainHandler.postDelayed(() -> {
            if (!keepListening || speechRecognizer == null) return;
            try {
                speechRecognizer.cancel();
                speechRecognizer.startListening(speechIntent);
            } catch (Exception error) {
                keepListening = false;
                restartingSpeech = false;
                sendVoiceEvent(voicePrefix, "error", "", false, "Microphone restart failed. Tap Start again.");
            }
        }, 350L);
    }

    private void stopVoiceRecognition() {
        keepListening = false;
        restartingSpeech = false;
        if (speechRecognizer != null) {
            try { speechRecognizer.stopListening(); } catch (Exception ignored) {}
        }
        sendVoiceEvent(voicePrefix, "stopped", "", false, "");
    }

    private String speechErrorMessage(int error) {
        switch (error) {
            case SpeechRecognizer.ERROR_AUDIO: return "Microphone audio error.";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: return "Microphone permission is required.";
            case SpeechRecognizer.ERROR_NETWORK:
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT: return "Speech service needs network or an offline language pack.";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY: return "Speech recognizer is busy. Stop and start again.";
            case SpeechRecognizer.ERROR_SERVER: return "Speech service error. Retry.";
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT: return "No speech heard. Continue speaking or tap Start.";
            case SpeechRecognizer.ERROR_NO_MATCH: return "Could not understand that speech. Try again.";
            default: return "Voice capture stopped. Tap Start to continue.";
        }
    }

    private void sendVoiceEvent(String prefix, String state, String text, boolean isFinal, String error) {
        String script = "window.__mrVoiceUpdate(" +
                org.json.JSONObject.quote(prefix == null ? "voice" : prefix) + "," +
                org.json.JSONObject.quote(state == null ? "" : state) + "," +
                org.json.JSONObject.quote(text == null ? "" : text) + "," +
                (isFinal ? "true" : "false") + "," +
                org.json.JSONObject.quote(error == null ? "" : error) + ");";
        runOnUiThread(() -> webView.evaluateJavascript(script, null));
    }

    @Override
    protected void onDestroy() {
        keepListening = false;
        if (speechRecognizer != null) {
            try { speechRecognizer.cancel(); } catch (Exception ignored) {}
            speechRecognizer.destroy();
            speechRecognizer = null;
        }
        super.onDestroy();
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
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            webReady = true;
            mainHandler.postDelayed(MainActivity.this::deliverPendingSanText, 250L);
        }

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
        public boolean canDrawOverlays() {
            return Settings.canDrawOverlays(MainActivity.this);
        }

        @JavascriptInterface
        public boolean isSanOverlayRunning() {
            return getSharedPreferences(SanOverlayService.PREFS, MODE_PRIVATE)
                    .getBoolean(SanOverlayService.KEY_RUNNING, false);
        }

        @JavascriptInterface
        public void requestSanOverlayPermission() {
            runOnUiThread(() -> {
                Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:" + getPackageName()));
                startActivity(intent);
            });
        }

        @JavascriptInterface
        public void startSanOverlay() {
            runOnUiThread(() -> {
                if (!Settings.canDrawOverlays(MainActivity.this)) {
                    Toast.makeText(MainActivity.this, "Allow Display over other apps, then tap Start overlay again.", Toast.LENGTH_LONG).show();
                    Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                            Uri.parse("package:" + getPackageName()));
                    startActivity(intent);
                    return;
                }
                Intent serviceIntent = new Intent(MainActivity.this, SanOverlayService.class);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(serviceIntent);
                else startService(serviceIntent);
                hapticFeedback("strong");
                Toast.makeText(MainActivity.this, "SAN copy overlay started", Toast.LENGTH_SHORT).show();
            });
        }

        @JavascriptInterface
        public void stopSanOverlay() {
            runOnUiThread(() -> {
                stopService(new Intent(MainActivity.this, SanOverlayService.class));
                Toast.makeText(MainActivity.this, "SAN copy overlay stopped", Toast.LENGTH_SHORT).show();
            });
        }

        @JavascriptInterface
        public String readClipboardText() {
            return MainActivity.this.readClipboardText();
        }

        @JavascriptInterface
        public String consumeSanOverlayText() {
            SharedPreferences prefs = getSharedPreferences(SanOverlayService.PREFS, MODE_PRIVATE);
            String text = prefs.getString(SanOverlayService.KEY_PENDING_TEXT, "");
            prefs.edit().remove(SanOverlayService.KEY_PENDING_TEXT).apply();
            return text == null ? "" : text;
        }

        @JavascriptInterface
        public void haptic(String kind) {
            runOnUiThread(() -> hapticFeedback(kind));
        }

        @JavascriptInterface
        public void fetchLocation(String prefix) {
            runOnUiThread(() -> requestNativeLocation(prefix == null ? "meeting" : prefix));
        }

        @JavascriptInterface
        public boolean hasPlacesApi() {
            return placesClient != null;
        }

        @JavascriptInterface
        public void searchNearbyHospitals(String prefix, double latitude, double longitude, double radiusMeters) {
            runOnUiThread(() -> MainActivity.this.searchNearbyHospitals(
                    prefix == null ? "nearby" : prefix, latitude, longitude, radiusMeters));
        }

        @JavascriptInterface
        public void searchDoctorPlaces(String prefix, String query) {
            runOnUiThread(() -> MainActivity.this.searchDoctorPlaces(
                    prefix == null ? "doctor-gps" : prefix, query));
        }

        @JavascriptInterface
        public void startVoiceCapture(String prefix) {
            runOnUiThread(() -> requestVoiceRecognition(prefix));
        }

        @JavascriptInterface
        public void stopVoiceCapture() {
            runOnUiThread(MainActivity.this::stopVoiceRecognition);
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
                pendingSaveBytes = null;

                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType(pendingSaveMime);
                intent.putExtra(Intent.EXTRA_TITLE, pendingSaveName);
                startActivityForResult(intent, REQUEST_SAVE);
            });
        }

        @JavascriptInterface
        public void saveWorkbook(String fileName, String workbookJson) {
            try {
                byte[] workbook = XlsxExporter.create(workbookJson);
                runOnUiThread(() -> {
                    pendingSaveName = fileName == null || fileName.trim().isEmpty() ? "MR-Field-Data.xlsx" : fileName;
                    pendingSaveMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                    pendingSaveContent = null;
                    pendingSaveBytes = workbook;

                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType(pendingSaveMime);
                    intent.putExtra(Intent.EXTRA_TITLE, pendingSaveName);
                    startActivityForResult(intent, REQUEST_SAVE);
                });
            } catch (Exception error) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Excel export failed: " + error.getMessage(), Toast.LENGTH_LONG).show());
            }
        }

        @JavascriptInterface
        public void saveReportPack(String fileName, String reportPackJson) {
            try {
                byte[] reportPack = ReportPackExporter.create(reportPackJson);
                runOnUiThread(() -> {
                    pendingSaveName = fileName == null || fileName.trim().isEmpty() ? "MR-Company-Report-Pack.zip" : fileName;
                    pendingSaveMime = "application/zip";
                    pendingSaveContent = null;
                    pendingSaveBytes = reportPack;

                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType(pendingSaveMime);
                    intent.putExtra(Intent.EXTRA_TITLE, pendingSaveName);
                    startActivityForResult(intent, REQUEST_SAVE);
                });
            } catch (Exception error) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Report pack export failed: " + error.getMessage(), Toast.LENGTH_LONG).show());
            }
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
