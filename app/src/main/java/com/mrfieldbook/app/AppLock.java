package com.mrfieldbook.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.hardware.biometrics.BiometricPrompt;
import android.os.CancellationSignal;
import android.text.InputType;
import android.widget.EditText;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.concurrent.Executor;

final class AppLock {
    private static long unlockedAt;
    private AppLock() {}

    static boolean enabled(Db db) { return !db.getSetting("pin_hash", "").isEmpty(); }
    static boolean biometricEnabled(Db db) { return "1".equals(db.getSetting("biometric_enabled", "0")); }

    static void requireUnlock(Activity activity, Db db, Runnable onUnlocked) {
        if (!enabled(db) || System.currentTimeMillis() - unlockedAt < 300_000L) {
            onUnlocked.run();
            return;
        }
        if (biometricEnabled(db)) showBiometric(activity, db, onUnlocked);
        else showPin(activity, db, onUnlocked);
    }

    private static void showPin(Activity activity, Db db, Runnable onUnlocked) {
        EditText pin = Ui.edit(activity, "4–8 digit PIN");
        pin.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_VARIATION_PASSWORD);
        AlertDialog dialog = new AlertDialog.Builder(activity)
                .setTitle("Unlock MR FieldBook")
                .setView(pin)
                .setCancelable(false)
                .setNegativeButton("Exit", (d, which) -> activity.finish())
                .setPositiveButton("Unlock", null)
                .create();
        dialog.setOnShowListener(x -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            if (verify(db, pin.getText().toString())) {
                unlockedAt = System.currentTimeMillis();
                dialog.dismiss();
                onUnlocked.run();
            } else {
                pin.setError("Wrong PIN");
                pin.setText("");
            }
        }));
        dialog.show();
    }

    private static void showBiometric(Activity activity, Db db, Runnable onUnlocked) {
        try {
            Executor executor = activity.getMainExecutor();
            BiometricPrompt prompt = new BiometricPrompt.Builder(activity)
                    .setTitle("Unlock MR FieldBook")
                    .setSubtitle("Use fingerprint or face")
                    .setNegativeButton("Use PIN", executor, (dialog, which) -> showPin(activity, db, onUnlocked))
                    .build();
            prompt.authenticate(new CancellationSignal(), executor, new BiometricPrompt.AuthenticationCallback() {
                @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                    unlockedAt = System.currentTimeMillis();
                    onUnlocked.run();
                }
                @Override public void onAuthenticationError(int errorCode, CharSequence errString) {
                    if (!activity.isFinishing()) {
                        showPin(activity, db, onUnlocked);
                    }
                }
            });
        } catch (Exception ignored) {
            showPin(activity, db, onUnlocked);
        }
    }

    static void setPin(Db db, String pin) {
        if (pin == null || !pin.matches("\\d{4,8}")) throw new IllegalArgumentException("PIN must be 4–8 digits");
        byte[] salt = new byte[16];
        new SecureRandom().nextBytes(salt);
        String encodedSalt = hex(salt);
        db.setSetting("pin_salt", encodedSalt);
        db.setSetting("pin_hash", hash(encodedSalt, pin));
        unlockedAt = System.currentTimeMillis();
    }

    static void clear(Db db) {
        db.setSetting("pin_salt", "");
        db.setSetting("pin_hash", "");
        db.setSetting("biometric_enabled", "0");
    }

    static boolean verify(Db db, String pin) {
        String salt = db.getSetting("pin_salt", "");
        return !salt.isEmpty() && constantTime(db.getSetting("pin_hash", ""), hash(salt, pin));
    }

    private static String hash(String salt, String pin) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = (salt + ":" + pin).getBytes(StandardCharsets.UTF_8);
            for (int i = 0; i < 12000; i++) bytes = digest.digest(bytes);
            return hex(bytes);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private static String hex(byte[] bytes) {
        StringBuilder result = new StringBuilder();
        for (byte b : bytes) result.append(String.format("%02x", b));
        return result.toString();
    }

    private static boolean constantTime(String a, String b) {
        if (a.length() != b.length()) return false;
        int result = 0;
        for (int i = 0; i < a.length(); i++) result |= a.charAt(i) ^ b.charAt(i);
        return result == 0;
    }
}
