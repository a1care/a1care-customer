# 📝 Project Release: Before Push Checklist

## 1. Firebase & Authentication (Critical)
- [ ] **Google Services**: Ensure `android/app/google-services.json` is present and corresponds to the `a1-care-hospitals` project.
- [ ] **SHA Fingerprints**: Run `./gradlew signingReport` and add the SHA-1 and SHA-256 keys to the Firebase Console (Settings > Project Settings).
- [ ] **Android Package Name**: Verify `app.json` has `package: "com.a1care.user"`.
- [ ] **Phone Auth**: Enable "Phone" in Firebase Console > Authentication > Sign-in method.
- [x] **Auth Bypass**: DELETE the `123123` OTP bypass in `patient.controller.ts` before deploying the backend.

## 2. API & Networking
- [x] **Base URL**: Ensure `EXPO_PUBLIC_API_URL` is `https://api.a1carehospital.in/api`.
- [ ] **CORS**: Verify backend `app.ts` allows requests from the production URLs (already set to `*` for now, consider narrowing).
- [ ] **Timeouts**: Ensure Axios timeout (currently 15s) is sufficient for slow 3G/4G connections.

## 3. Wallet & Payments
- [ ] **Razorpay Keys**: Add `RAZORPAY_KEY_ID` and `RAZORPAY_SECRET` to the backend `.env`.
- [ ] **Simulation**: Verify that the "Simulated Top-up" note has been replaced with the payment gateway bridge.

## 4. Build & Environment
- [ ] **Path Issues**: If building on a local machine, move the project to a directory without spaces (e.g., `C:/a1care/`).
- [x] **ProGuard**: Enable ProGuard in `android/app/build.gradle` (currently likely `false`) to shrink and obfuscate the code.
- [ ] **Version Code**: Increment `versionCode` in `app.json` before every play store submission.

## 5. Assets & UI
- [x] **Image Compression**: Run a compressor on the `assets/images` folder (found several >500KB files).
- [ ] **Splash Screen**: Ensure the splash screen logic is correctly integrated in `_layout.tsx`.

## 6. Testing Final Run
- [ ] **End-to-End**: Test `Login` -> `Profile Edit` -> `Service Booking` -> `Wallet Payment`.
- [ ] **Offline Mode**: Verify that the app shows a fallback (or at least doesn't crash) when internet is disconnected.
- [ ] **Permissions**: Test Location permission flow on the Home screen.
