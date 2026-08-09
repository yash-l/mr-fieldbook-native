package com.mrone.fieldapp;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.IBinder;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

public final class SanOverlayService extends Service {
    public static final String PREFS = "mr_native_prefs";
    public static final String KEY_PENDING_TEXT = "pending_san_text";
    public static final String KEY_RUNNING = "san_overlay_running";
    private static final String CHANNEL_ID = "mr_san_overlay";
    private static final int NOTIFICATION_ID = 1404;

    private WindowManager windowManager;
    private LinearLayout root;
    private LinearLayout panel;
    private WindowManager.LayoutParams params;
    private EditText pasteBox;
    private float downRawX;
    private float downRawY;
    private int downX;
    private int downY;
    private boolean moved;

    @Override
    public void onCreate() {
        super.onCreate();
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean(KEY_RUNNING, true).apply();
        createNotificationChannel();
        Notification notification = buildNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
        showOverlay();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (root == null) showOverlay();
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "SAN copy overlay",
                NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Keeps the visible SAN copy bubble available while field work is active.");
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    private Notification buildNotification() {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, CHANNEL_ID)
                : new Notification.Builder(this);
        return builder
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("MR SAN copy overlay active")
                .setContentText("Copy in SAN, then tap the MR bubble to review and send.")
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setCategory(Notification.CATEGORY_SERVICE)
                .build();
    }

    private GradientDrawable background(int color, float radiusDp, int strokeColor) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(dp(radiusDp));
        if (strokeColor != Color.TRANSPARENT) drawable.setStroke(dp(1), strokeColor);
        return drawable;
    }

    private TextView text(String value, int sizeSp, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(sizeSp);
        view.setTextColor(color);
        view.setGravity(Gravity.CENTER_VERTICAL);
        if (bold) view.setTypeface(view.getTypeface(), android.graphics.Typeface.BOLD);
        return view;
    }

    private Button button(String label, int backgroundColor, int textColor) {
        Button button = new Button(this);
        button.setAllCaps(false);
        button.setText(label);
        button.setTextSize(12);
        button.setTextColor(textColor);
        button.setTypeface(button.getTypeface(), android.graphics.Typeface.BOLD);
        button.setBackground(background(backgroundColor, 14, Color.TRANSPARENT));
        button.setPadding(dp(12), dp(8), dp(12), dp(8));
        return button;
    }

    private void showOverlay() {
        if (root != null) return;
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        if (windowManager == null) {
            stopSelf();
            return;
        }

        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.END);
        root.setPadding(dp(6), dp(6), dp(6), dp(6));

        TextView bubble = text("MR", 16, Color.WHITE, true);
        bubble.setGravity(Gravity.CENTER);
        bubble.setBackground(background(Color.rgb(15, 118, 110), 28, Color.WHITE));
        LinearLayout.LayoutParams bubbleLp = new LinearLayout.LayoutParams(dp(56), dp(56));
        bubbleLp.gravity = Gravity.END;
        bubble.setLayoutParams(bubbleLp);
        bubble.setElevation(dp(12));
        root.addView(bubble);

        panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setPadding(dp(14), dp(14), dp(14), dp(14));
        panel.setBackground(background(Color.WHITE, 22, Color.rgb(214, 224, 234)));
        panel.setElevation(dp(16));
        panel.setVisibility(View.GONE);
        LinearLayout.LayoutParams panelLp = new LinearLayout.LayoutParams(dp(326), WindowManager.LayoutParams.WRAP_CONTENT);
        panelLp.topMargin = dp(8);
        panel.setLayoutParams(panelLp);

        TextView title = text("SAN → MR Copy Box", 16, Color.rgb(17, 24, 39), true);
        panel.addView(title);
        TextView help = text("SAN me detail select karke Copy karo. Yahan Paste clipboard tap karo, review karo, phir Send to MR.", 11, Color.rgb(93, 105, 123), false);
        help.setPadding(0, dp(4), 0, dp(10));
        panel.addView(help);

        pasteBox = new EditText(this);
        pasteBox.setHint("Doctor, hospital, chemist, timing, products…");
        pasteBox.setTextSize(13);
        pasteBox.setTextColor(Color.rgb(17, 24, 39));
        pasteBox.setHintTextColor(Color.rgb(140, 150, 165));
        pasteBox.setMinLines(4);
        pasteBox.setMaxLines(8);
        pasteBox.setGravity(Gravity.TOP | Gravity.START);
        pasteBox.setPadding(dp(12), dp(10), dp(12), dp(10));
        pasteBox.setBackground(background(Color.rgb(247, 249, 252), 14, Color.rgb(216, 224, 234)));
        panel.addView(pasteBox, new LinearLayout.LayoutParams(WindowManager.LayoutParams.MATCH_PARENT, dp(128)));

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams rowLp = new LinearLayout.LayoutParams(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.WRAP_CONTENT);
        rowLp.topMargin = dp(10);
        panel.addView(row, rowLp);

        Button pasteButton = button("Paste clipboard", Color.rgb(232, 245, 243), Color.rgb(10, 92, 85));
        Button sendButton = button("Send to MR", Color.rgb(15, 118, 110), Color.WHITE);
        LinearLayout.LayoutParams actionLp = new LinearLayout.LayoutParams(0, dp(46), 1f);
        actionLp.rightMargin = dp(6);
        row.addView(pasteButton, actionLp);
        LinearLayout.LayoutParams sendLp = new LinearLayout.LayoutParams(0, dp(46), 1f);
        sendLp.leftMargin = dp(6);
        row.addView(sendButton, sendLp);

        LinearLayout footer = new LinearLayout(this);
        footer.setOrientation(LinearLayout.HORIZONTAL);
        footer.setGravity(Gravity.END);
        LinearLayout.LayoutParams footerLp = new LinearLayout.LayoutParams(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.WRAP_CONTENT);
        footerLp.topMargin = dp(8);
        panel.addView(footer, footerLp);
        Button openButton = button("Open app", Color.rgb(238, 242, 247), Color.rgb(40, 52, 70));
        Button closeButton = button("Stop overlay", Color.rgb(255, 235, 232), Color.rgb(180, 35, 24));
        LinearLayout.LayoutParams smallLp = new LinearLayout.LayoutParams(WindowManager.LayoutParams.WRAP_CONTENT, dp(42));
        smallLp.leftMargin = dp(8);
        footer.addView(openButton, smallLp);
        footer.addView(closeButton, smallLp);

        root.addView(panel);

        params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT
        );
        params.gravity = Gravity.TOP | Gravity.START;
        params.x = Math.max(dp(8), getResources().getDisplayMetrics().widthPixels - dp(72));
        params.y = dp(160);
        windowManager.addView(root, params);

        bubble.setOnTouchListener((view, event) -> {
            switch (event.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    downRawX = event.getRawX();
                    downRawY = event.getRawY();
                    downX = params.x;
                    downY = params.y;
                    moved = false;
                    return true;
                case MotionEvent.ACTION_MOVE:
                    float dx = event.getRawX() - downRawX;
                    float dy = event.getRawY() - downRawY;
                    if (Math.abs(dx) > dp(4) || Math.abs(dy) > dp(4)) moved = true;
                    params.x = Math.max(0, downX + Math.round(dx));
                    params.y = Math.max(0, downY + Math.round(dy));
                    windowManager.updateViewLayout(root, params);
                    return true;
                case MotionEvent.ACTION_UP:
                    if (!moved) togglePanel();
                    return true;
                default:
                    return false;
            }
        });

        pasteButton.setOnClickListener(v -> pasteClipboard());
        sendButton.setOnClickListener(v -> sendToApp());
        openButton.setOnClickListener(v -> openApp());
        closeButton.setOnClickListener(v -> stopSelf());
    }

    private void togglePanel() {
        boolean show = panel.getVisibility() != View.VISIBLE;
        panel.setVisibility(show ? View.VISIBLE : View.GONE);
        int screenWidth = getResources().getDisplayMetrics().widthPixels;
        params.x = show ? Math.max(dp(8), screenWidth - dp(340)) : Math.min(params.x, Math.max(dp(8), screenWidth - dp(72)));
        params.flags = show
                ? WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN | WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH
                : WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN;
        windowManager.updateViewLayout(root, params);
        if (show) {
            pasteBox.requestFocus();
            pasteBox.setSelection(pasteBox.length());
        } else {
            InputMethodManager imm = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
            if (imm != null) imm.hideSoftInputFromWindow(pasteBox.getWindowToken(), 0);
        }
    }

    private String clipboardText() {
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

    private void pasteClipboard() {
        String text = clipboardText();
        if (text.isEmpty()) {
            pasteBox.requestFocus();
            Toast.makeText(this, "Clipboard unavailable. Long-press the box and tap Paste.", Toast.LENGTH_LONG).show();
            return;
        }
        pasteBox.setText(text);
        pasteBox.setSelection(pasteBox.length());
        Toast.makeText(this, "SAN text pasted. Review before sending.", Toast.LENGTH_SHORT).show();
    }

    private void sendToApp() {
        String text = pasteBox.getText() == null ? "" : pasteBox.getText().toString().trim();
        if (text.isEmpty()) text = clipboardText();
        if (text.isEmpty()) {
            Toast.makeText(this, "Paste or type details first.", Toast.LENGTH_SHORT).show();
            return;
        }
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        prefs.edit().putString(KEY_PENDING_TEXT, text).apply();
        openApp();
        Toast.makeText(this, "Sent to MR review screen.", Toast.LENGTH_SHORT).show();
    }

    private void openApp() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("from_san_overlay", true);
        startActivity(intent);
    }

    private int dp(float value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    public void onDestroy() {
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean(KEY_RUNNING, false).apply();
        if (windowManager != null && root != null) {
            try {
                windowManager.removeView(root);
            } catch (Exception ignored) {
            }
        }
        root = null;
        super.onDestroy();
    }
}
