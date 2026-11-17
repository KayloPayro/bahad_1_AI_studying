# לומדות AI לצוערים

מונוריפו של לומדות לעבודה נכונה עם כלי AI, לפי [האפיון](אפיון%20לומדת%20AI%20לצוערים.md). אתר סטטי אחד שנפתח מכל טלפון ומחשב, בלי שרת, ומעקב התקדמות לגיליון Google דרך Apps Script.

## מבנה

| תיקייה | מה יש בה |
| --- | --- |
| `packages/engine` | המנוע: מריץ לומדה מקובץ תוכן, שבעת השלבים, טיימר, מעקב, מצב מדריך, ניקוד לפי מחוון |
| `packages/ui` | רכיבי ממשק: סימולטור צ'אט, מציג מסמך, עורך הנחיה, תיבת תוצר ובודקים, קלפים, מסך כניסה, סימן מים |
| `packages/checkers` | בודקים טהורים: מילות מפתח, שורה ראשונה, הפניות, אורך, בדיקת מספרים, חלון זמן |
| `packages/tracking` | מספר אישי, תור אירועים במכשיר ושליחה ל-Apps Script |
| `packages/schema` | טיפוסים ו-JSON Schema לקובץ התוכן, ובדיקות סמנטיות |
| `packages/theme` | טוקנים (בהיר וכהה), RTL, גופנים, סגנון הרכיבים |
| `packages/config` | קורא את `site.config.json` |
| `packages/build` | תצורת Vite משותפת |
| `modules/lNN-*` | **לומדה = חבילה נפרדת**: `content.json`, ורכיבים ייחודיים ב-`src/` אם צריך |
| `apps/site` | דף הבית, עמוד הסגל, manifest ואייקונים |
| `apps-script` | הסקריפט לגיליון והוראות פריסה |
| `e2e` | בדיקות Playwright בטלפון 360px ובמחשב |

לומדות 1 ו-2 עובדות מקצה לקצה. לומדות 3 עד 12 מוצגות כשלד: כרטיס לומדה ומהלך המסכים לפי האפיון, בלי תרגול ובלי מעקב.

## הגדרות: `site.config.json`

| שדה | ברירת מחדל | הערה |
| --- | --- | --- |
| `PN_LENGTH` | 7 | אורך המספר האישי. אותו ערך צריך להיות ב-`PN_LENGTH` של הסקריפט |
| `TEAMS` | 1 עד 20 | רשימת הצוותים במסך הכניסה |
| `TRACKING_URL` | ריק | כתובת ה-Web App. כל עוד ריק, האירועים נשמרים בתור במכשיר |
| `INSTRUCTOR_CODE_SHA256` | הקוד `bahad1` | SHA-256 של קוד המדריך. להחלפה: `node -e "console.log(require('crypto').createHash('sha256').update('הקוד').digest('hex'))"` |

## פקודות

```bash
npm install              # פעם אחת
npm run dev              # דף הבית
npm run dev:l01          # לומדה 1 לבד (כל לומדה: npm run dev -w @lumda/lNN)
npm run check            # typecheck + lint + בדיקות יחידה + אימות תוכן
npm run build:all        # בונה הכול ל-dist/
npm run preview          # מגיש את dist/ כמו GitHub Pages
npm run e2e              # בדיקות Playwright (בונה בעצמו)
npm run icons            # מייצר אייקונים מ-Bahad_1_Symbol.svg
```

**ב-Windows:** הריצו את הבדיקות מנתיב שמתחיל ב-`C:` גדולה (`cd C:\Users\...`). Vitest טוען את המודול פעמיים כשהטרמינל נפתח עם `c:` קטנה, והבדיקות נכשלות בשגיאה `reading 'config'`.

## הוספת לומדה

```bash
npx tsx scripts/new-module.ts l13-example "כותרת הלומדה"
npm install
```

אחר כך עורכים את `modules/l13-example/content.json` ומריצים `npm run validate`. רכיב שלא קיים במנוע נרשם כ-step מסוג `custom` ב-`src/main.tsx` של הלומדה. לדוגמה, הקלפים שהכלי לא שאל עליהם בלומדה 2.

## פריסה

- **ענפים:** עובדים ב-`dev`. CI רץ על כל דחיפה ל-`dev` ועל PR.
- **פרסום:** מיזוג ל-`main` מפרסם ל-GitHub Pages.
- **הפעלה חד-פעמית:** Settings → Pages → Source: **GitHub Actions**.
- **מעקב:** [apps-script/README.md](apps-script/README.md).
