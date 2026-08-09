# Google Places setup for live nearby hospitals

Live search is optional. Saved nearby hospitals and the rest of the app work without it.

## 1. Google Cloud

1. Create or select a Google Cloud project.
2. Attach a billing account.
3. Enable **Places API (New)**.
4. Create an API key.
5. Restrict the key to the Places API and configure Android application restrictions when you have a stable signing certificate.
6. Set a small daily quota/budget alert while testing.

Do not write the key inside JavaScript, Java source or Git commits.

## 2. GitHub secret

Repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Name:

`PLACES_API_KEY`

Value:

Your Google Places API key.

The workflow injects the secret only during the APK build.

## 3. Build

Push to `main`, or run:

Actions → **Build Android APK** → **Run workflow**

Download artifact:

`MR-Machine-Intelligence-v14-APK`

## Important key-security note

A debug APK produced on temporary GitHub runners may not have a stable signing SHA-1 across every rebuild. For strict Android app restrictions and long-term use, sign release APKs with one stable private keystore, then restrict the key to package `com.mrfieldbook.app` and that certificate SHA-1. Until then, limit the API itself and set conservative quotas; never publish an unrestricted key.
