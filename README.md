# نظام طلبات مطعم عبر QR

## التشغيل
1. ثبّت Node.js
2. انسخ `.env.example` إلى `.env`
3. ضع:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
   - `CASHIER_SECRET`
4. شغّل:
   ```bash
   npm install
   npm start
   ```

## الصفحات
- الزبون: `http://localhost:3000/?table=12`
- الأدمين: `http://localhost:3000/admin`
- الكاشير: `http://localhost:3000/cashier?secret=YOUR_SECRET`

## ملاحظة
- Telegram يحتاج Bot Token وChat ID صحيحين.
- الكاشير يعمل عبر صفحة مخصصة مع تحديث تلقائي.
- البيانات محفوظة في `data/database.json`.
