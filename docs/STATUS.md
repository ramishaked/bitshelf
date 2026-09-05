# סטטוס: שלב 1, שבוע 1 (שלד)

עודכן: 05.09.2026

## מה קיים

- **Monorepo:** pnpm workspaces + Turborepo. `pnpm typecheck` ו-`pnpm test` ירוקים על כל החבילות.
- **packages/db:** סכמת Drizzle מלאה לטבלאות ה-Core מסעיף 4 בספק: users, collections, collection_types, items (attributes כ-jsonb, עמודות generated ל-manufacturer, model, year, ו-search_text כ-tsvector), item_photos, repair_logs, galleries, gallery_items, favorites, price_observations, price_sources, wishlist_items, value_snapshots, ai_jobs, insights. Seed של retro_tech ב-`packages/db/seeds/retro_tech.json` כולל קטגוריות, attributes_schema (כולל שדות software), תוויות מצב ו-system prompt לזיהוי. הרצת seed: `pnpm --filter @bitshelf/db push` ואז `pnpm --filter @bitshelf/db seed` (דורש DATABASE_URL).
- **packages/ui:** `theme.ts` עם כל ה-tokens מסעיפים 15.3 ו-15.4, dark ו-light. אין hex מחוץ לקובץ הזה (חריג יחיד: צבע ה-splash ב-`apps/mobile/app.json`, קובץ JSON סטטי שלא יכול לייבא tokens, הערך זהה ל-brand.splashBackground). בקובץ יש שני צבעים נגזרים שלא הוגדרו בספק ומסומנים בהערה: textSecondary ו-accentPressed במצב light.
- **packages/i18n:** i18next עם he.json ו-en.json, עברית ברירת מחדל. RTL מוחל ברמת ה-native דרך `extra.supportsRTL` ו-`extra.forcesRTL` ב-app.json (expo-localization), לפני שה-JS רץ. הגישה הקודמת (forceRTL בזמן ריצה עם reload) שברה את Expo Go והוחלפה, הספק עודכן בהתאם (סעיף 10).
- **apps/mobile:** Expo SDK 57 עם expo-router. ארבעה טאבים (אוסף, גלריות, מועדפים, פרופיל) עם SF Symbols דרך expo-symbols. טאב האוסף מציג מצב ריק עם placeholder ללוגו והטקסט מסעיף 15.2. מסך התחברות עם Apple, Google ואימייל (קוד), ומצב אורח שמוביל רק למסך גלריה ציבורית `/g/[slug]`.
- **apps/web:** Next.js 16. דף בית, דף גלריה ציבורית `/g/[slug]` (placeholder, SSR), ו-route `POST /api/upload-url` שמחזיר signed URL להעלאה ל-R2 (דורש התחברות). Middleware של Clerk עם routes ציבוריים לגלריות.
- **.env.example** בשורש עם כל המשתנים והסבר שורה לכל אחד.

## מה נבדק

- `pnpm typecheck` עובר על כל 6 החבילות.
- האפליקציה רצה ב-Expo Go על סימולטור iPhone 17 Pro (iOS 26.5): dark, עברית, RTL מלא, טאב אוסף פעיל עם המצב הריק, סדר טאבים נכון. הרצה: `pnpm --filter @bitshelf/mobile ios`.

## מה צריך להגדיר ידנית

1. **Clerk:** ליצור אפליקציה ב-dashboard, להפעיל Apple, Google ו-email code, ולמלא CLERK_SECRET_KEY, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ו-EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. בלי מפתחות, המובייל רץ במצב פיתוח בלי התחברות (ישר לטאבים) וה-web מדלג על ה-middleware.
2. **Neon:** ליצור פרויקט ולמלא DATABASE_URL, ואז להריץ push ו-seed (פקודות למעלה).
3. **R2:** ליצור bucket ו-API token עם הרשאת קריאה וכתיבה לאובייקטים, ולמלא את חמשת משתני R2_*.

## הערות

- pnpm חייב לרוץ עם `nodeLinker: hoisted` (מוגדר ב-pnpm-workspace.yaml). המבנה ה-isolated של pnpm שובר את Expo Go בזמן ריצה (Cannot find native module). ב-pnpm 11 ההגדרה חייבת לשבת ב-pnpm-workspace.yaml, לא ב-.npmrc.
- התחברות באימייל (קוד) עובדת רק לחשבון קיים. חשבון חדש נוצר דרך Apple או Google, או ידנית ב-dashboard של Clerk.
- אייקון ו-splash הם עדיין ה-placeholders של תבנית Expo. הלוגו הווקטורי ייכנס ל-`packages/ui/assets` בהמשך (סעיף 15.1).
- לא נבנה שום דבר משבוע 2 והלאה: אין יצירת פריט, אין AI, אין דשבורד.
