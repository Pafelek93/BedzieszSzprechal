
# DeutschMaster - Build Instructions for Android (APK)

Twoja aplikacja jest gotowa do zamiany w natywny plik APK.

## Szybka metoda (PWABuilder)
1. Wgraj kod na hosting (np. Vercel, Netlify).
2. Skopiuj adres URL swojej aplikacji.
3. Wejdź na [PWABuilder.com](https://www.pwabuilder.com).
4. Wpisz URL i kliknij "Start".
5. Kliknij "Next" aż dojdziesz do "Build my PWA".
6. Pobierz pakiet Android. Otrzymasz gotowy plik `.apk`.

## Dlaczego to działa?
Aplikacja posiada poprawny `manifest.json` oraz `sw.js`, co pozwala narzędziom Google i Microsoftu na automatyczne opakowanie jej w tzw. **Trusted Web Activity**. Dzięki temu aplikacja:
- Działa bez paska przeglądarki.
- Ma własną ikonę w menu Androida.
- Jest bardzo lekka (zajmuje ok. 1-2 MB).
