# MR One Fast Update — one-time setup

MR One v1.4.4 introduces a direct in-app updater. Android requires every future APK update for the same package to be signed by the same signing key, so a persistent release keystore is required.

## 1. Create the persistent signing key in Termux

Run once:

```bash
cd ~
mkdir -p MR-One-Signing
chmod 700 MR-One-Signing

PASS="$(openssl rand -hex 24)"
KEYSTORE="$HOME/MR-One-Signing/mr-one-release.jks"
ALIAS="mrone"

keytool -genkeypair \
  -keystore "$KEYSTORE" \
  -alias "$ALIAS" \
  -keyalg RSA \
  -keysize 4096 \
  -validity 10000 \
  -storepass "$PASS" \
  -keypass "$PASS" \
  -dname "CN=MR One, O=MR One, C=IN"

printf '%s' "$PASS" > "$HOME/MR-One-Signing/signing-password.txt"
printf '%s' "$ALIAS" > "$HOME/MR-One-Signing/signing-alias.txt"
chmod 600 "$KEYSTORE" "$HOME/MR-One-Signing/signing-password.txt" "$HOME/MR-One-Signing/signing-alias.txt"
```

Keep the `MR-One-Signing` folder private. Do not commit it to GitHub and do not share the keystore/password.

## 2. Save the signing material as GitHub Actions secrets

From any folder while `gh` is logged in to the correct GitHub account:

```bash
KEYSTORE="$HOME/MR-One-Signing/mr-one-release.jks"
PASS="$(cat "$HOME/MR-One-Signing/signing-password.txt")"
ALIAS="$(cat "$HOME/MR-One-Signing/signing-alias.txt")"

base64 < "$KEYSTORE" | tr -d '\n' | gh secret set ANDROID_KEYSTORE_BASE64 -R yash-l/mr-fieldbook-native
printf '%s' "$PASS" | gh secret set ANDROID_KEYSTORE_PASSWORD -R yash-l/mr-fieldbook-native
printf '%s' "$ALIAS" | gh secret set ANDROID_KEY_ALIAS -R yash-l/mr-fieldbook-native
printf '%s' "$PASS" | gh secret set ANDROID_KEY_PASSWORD -R yash-l/mr-fieldbook-native

gh secret list -R yash-l/mr-fieldbook-native
```

The list should show all four secret names. Secret values are never printed back by GitHub.

## 3. First stable-signed install

Older MR One builds were built with GitHub-runner debug signing. That debug certificate is not persistent, so Android may reject v1.4.4 as an in-place update.

Before the first stable-signed install:

1. Open MR One → Tools → Full backup and save the JSON.
2. Build v1.4.4 after the signing secrets are configured.
3. If Android says the package signature does not match, uninstall **MR One** (`com.mrone.fieldapp`) only.
4. Install the v1.4.4 signed release APK.
5. Restore the JSON backup.

The separate trial app package `com.mrfieldbook.app` is not affected.

After this one-time migration, future MR One release APKs are signed with the same key and can update in place through Tools → App update.

## 4. Future update flow

1. Open MR One → Tools → App update.
2. Tap Check update.
3. Tap Download & Update.
4. On first use only, Android may ask to allow installs from MR One.
5. Confirm Update in Android installer.

No Termux artifact download command is needed for normal future installs.
