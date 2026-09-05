# סטטוס: שלב 1

עודכן: 05.09.2026

## שבוע 3 (זיהוי AI, מסך אישור, כפילויות)

- מסך מצלמה (`/capture`): מסגרת מנחה, פלאש, צילום רצף, בחירה מהספרייה, כפתור "זהה". בסימולטור אין מצלמה (תצוגה שחורה), במכשיר אמיתי עובד; מהספרייה עובד גם בסימולטור.
- `POST /api/identify` בשרת: עד 4 תמונות base64, קריאה אחת ל-Claude (מודל claude-sonnet-5 לפי הספק, Opus שמור לסריקת מדף) עם ה-ai_system_prompt מה-seed, effort נמוך ליעד 4 עד 8 שניות. כל קריאה נרשמת כ-AiJob עם טוקנים, עלות וזמן.
- מסך אישור לפי ארטבורד 03: שדות מלאים, שדות עם confidence נמוך מסומנים בענבר עם "לבדוק", alternatives כ-chips, מצב חיצוני ומצב תפקודי כשני בוררים נפרדים (ברירת מחדל לא נבדק), מיקום, שמירה בלי חסימות. הערות מצב מה-AI נשמרות כ-condition_notes.
- בדיקת כפילויות לפני שמירה (אותו יצרן+דגם+גרסה): "יש לך כבר X. להוסיף עותק נוסף?".
- **דורש ANTHROPIC_API_KEY ב-apps/web/.env.local. עד שאין מפתח, הזיהוי מחזיר 503 ומסך האישור מציג שגיאה עם נתיב ידני.**

## הרצה מהאייפון (Expo Go)

התקנת Expo Go מה-App Store, אייפון ו-Mac באותו Wi-Fi, סריקת ה-QR שה-Metro מדפיס (או הזנת exp://<כתובת המק>:8081 ידנית ב-Expo Go). ה-API מוגדר ב-apps/mobile/.env לכתובת ה-LAN של ה-Mac כדי שסנכרון וזיהוי יעבדו גם מהמכשיר. שני השרתים (Metro ו-next dev) חייבים לרוץ על ה-Mac.

## שבוע 2 (הוספת פריט, תמונות, מסך פריט)

- הוספה ידנית עובדת local-first: כפתור "+" צף בגלריה, טופס שנבנה מה-attributes_schema של ה-seed (כולל שדות software מותנים), אף שדה לא חוסם שמירה, תג "להשלים" לפריט חסר.
- תמונות: מצלמה או ספרייה, הקטנה על המכשיר ל-2000px + thumbnail 400px (המקור לא נשמר), קבצים ב-documents של האפליקציה.
- גריד: FlashList, 3 עמודות עם רווח 2px לפי העיצוב, נקודת סטטוס, שם במונו על gradient תחתון. נפתח מ-SQLite בלי רשת.
- מסך פריט: קרוסלת תמונות, שורת תגים (מצב תפקודי ומצב חיצוני בנפרד, לפי העיקרון), כרטיסי פרטים, רכישה והערות, עריכה ומחיקה.
- סנכרון לשרת עדיין לא מחובר: פריטים מסומנים synced=0 ומחכים ל-API (דורש מפתחות Clerk ו-DATABASE_URL). ה-jsonb, ה-generated columns וה-route להעלאת R2 כבר קיימים מצד השרת.
- שני פריטי בדיקה (Apple IIc, C64) הוזרקו ל-SQLite בסימולטור לצורך אימות ויזואלי. מחיקה: מתוך מסך הפריט, או איפוס הסימולטור.

## שבוע 1 (שלד)

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

## מה מוגדר ומה חסר

1. **Clerk: מוגדר (05.09.2026).** אפליקציית bitshelf, passwordless: קוד אימייל, Google ו-Apple. חשוב: password, username ו-phone כבויים בהגדרות, אחרת ההרשמה נתקעת על missing_requirements. מסך הכניסה עושה sign-in וכשהחשבון לא קיים עובר אוטומטית ל-sign-up עם אותו קוד. המפתחות ב-apps/web/.env.local וב-apps/mobile/.env (מקומיים, לא ב-git).
2. **Neon: מוגדר (05.09.2026).** פרויקט bitshelf ב-Frankfurt, כל הטבלאות נוצרו (drizzle push) ו-retro_tech נזרע. מיגרציות רצות מול ה-endpoint הישיר (בלי pooler-), האפליקציה מול ה-pooler.
3. **R2: עדיין חסר.** ליצור bucket ו-API token עם הרשאת קריאה וכתיבה לאובייקטים, ולמלא את חמשת משתני R2_*. נחוץ להעלאת תמונות לענן.
4. **סנכרון לשרת: עובד (05.09.2026).** `POST /api/sync` עם אימות Clerk: יוצר משתמש ואוסף ב-Neon בקריאה הראשונה, ומקבל upsert של פריטים (עד 200 בבקשה, רק של הבעלים). המובייל דוחף פריטים לא מסונכרנים בכניסה, כל חצי דקה, ואחרי כל שמירה. תמונות עדיין לא עולות, מחכות ל-R2. בפיתוח נדרש `next dev` רץ (localhost:3000).

## הערות

- pnpm חייב לרוץ עם `nodeLinker: hoisted` (מוגדר ב-pnpm-workspace.yaml). המבנה ה-isolated של pnpm שובר את Expo Go בזמן ריצה (Cannot find native module). ב-pnpm 11 ההגדרה חייבת לשבת ב-pnpm-workspace.yaml, לא ב-.npmrc.
- התחברות באימייל (קוד) עובדת רק לחשבון קיים. חשבון חדש נוצר דרך Apple או Google, או ידנית ב-dashboard של Clerk.
- אייקון ו-splash הם עדיין ה-placeholders של תבנית Expo. הלוגו הווקטורי ייכנס ל-`packages/ui/assets` בהמשך (סעיף 15.1).
- לא נבנה שום דבר משבוע 2 והלאה: אין יצירת פריט, אין AI, אין דשבורד.
