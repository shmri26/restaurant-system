const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const CASHIER_SECRET = process.env.CASHIER_SECRET || 'change_this_secret';

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'database.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({
    items: [],
    orders: [],
    tables: []
  }, null, 2), 'utf8');
}

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

function loadDB() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveDB(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function money(n) {
  return `${Number(n || 0).toLocaleString('ar-IQ')} د.ع`;
}

function defaultItems() {
  return [
    { id: uid(), name: 'بيبسي', category: 'المشروبات الغازية', price: 1500, image: '', desc: 'مشروب غازي بارد' },
    { id: uid(), name: 'سفن آب', category: 'المشروبات الغازية', price: 1500, image: '', desc: 'مشروب منعش' },
    { id: uid(), name: 'شاي', category: 'المشروبات الحارة', price: 1000, image: '', desc: 'شاي حار' },
    { id: uid(), name: 'قهوة', category: 'المشروبات الحارة', price: 2000, image: '', desc: 'قهوة عربية' },
    { id: uid(), name: 'برجر لحم', category: 'البرجر', price: 6500, image: '', desc: 'برجر لحم محضر طازج' },
    { id: uid(), name: 'برجر دجاج', category: 'البرجر', price: 6000, image: '', desc: 'برجر دجاج طري' },
    { id: uid(), name: 'ساج دجاج', category: 'الساج', price: 7000, image: '', desc: 'ساج شهي' },
    { id: uid(), name: 'فلافل ساندويش', category: 'الفلافل', price: 3500, image: '', desc: 'فلافل مقرمشة' },
    { id: uid(), name: 'شاورما دجاج', category: 'الشاورما', price: 5500, image: '', desc: 'شاورما مع صوص خاص' },
    { id: uid(), name: 'تمن ومرق لحم', category: 'التمن والمرق', price: 8000, image: '', desc: 'وجبة عراقية كاملة' },
    { id: uid(), name: 'كباب', category: 'الأطباق', price: 9000, image: '', desc: 'طبق كباب مشوي' },
    { id: uid(), name: 'بطاطا', category: 'الإضافات', price: 2000, image: '', desc: 'بطاطا مقلية' },
  ];
}

function ensureSeed() {
  const db = loadDB();
  if (!db.items || db.items.length === 0) {
    db.items = defaultItems();
    saveDB(db);
  }
}
ensureSeed();

async function sendTelegramMessage(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return { ok: false, reason: 'telegram_not_configured' };
  }
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });
    const data = await response.json();
    return { ok: data.ok, data };
  } catch (error) {
    return { ok: false, reason: error.message };
  }
}

function formatOrderTelegram(order) {
  const lines = [];
  lines.push(`🆕 <b>طلب جديد</b>`);
  lines.push(`🪑 الطاولة: <b>${order.table}</b>`);
  lines.push(`🕒 الوقت: ${order.time}`);
  lines.push('');
  order.items.forEach((it, idx) => {
    lines.push(`${idx + 1}. ${it.name} × ${it.qty} = ${money(it.price * it.qty)}`);
  });
  lines.push('');
  lines.push(`💰 الإجمالي: <b>${money(order.total)}</b>`);
  if (order.notes) lines.push(`📝 ملاحظات: ${order.notes}`);
  lines.push('');
  lines.push(`#order_${order.id}`);
  return lines.join('\n');
}

function getDBSummary() {
  const db = loadDB();
  return {
    items: db.items || [],
    orders: db.orders || [],
    tables: db.tables || []
  };
}

app.get('/api/health', (_, res) => {
  res.json({ ok: true, now: new Date().toISOString() });
});

app.get('/api/items', (_, res) => {
  const db = loadDB();
  res.json(db.items || []);
});

app.post('/api/items', (req, res) => {
  const { name, category, price, image, desc } = req.body || {};
  if (!name || !category || !price) {
    return res.status(400).json({ ok: false, error: 'name_category_price_required' });
  }
  const db = loadDB();
  const item = {
    id: uid(),
    name: String(name).trim(),
    category: String(category).trim(),
    price: Number(price),
    image: String(image || '').trim(),
    desc: String(desc || '').trim(),
  };
  db.items.unshift(item);
  saveDB(db);
  res.json({ ok: true, item });
});

app.put('/api/items/:id', (req, res) => {
  const db = loadDB();
  const idx = db.items.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'item_not_found' });
  const prev = db.items[idx];
  db.items[idx] = {
    ...prev,
    ...req.body,
    price: req.body.price !== undefined ? Number(req.body.price) : prev.price
  };
  saveDB(db);
  res.json({ ok: true, item: db.items[idx] });
});

app.delete('/api/items/:id', (req, res) => {
  const db = loadDB();
  db.items = db.items.filter(i => i.id !== req.params.id);
  saveDB(db);
  res.json({ ok: true });
});

app.get('/api/orders', (req, res) => {
  const db = loadDB();
  let orders = db.orders || [];
  if (req.query.status === 'open') {
    orders = orders.filter(o => o.status !== 'done' && o.status !== 'cancelled');
  }
  res.json(orders);
});

app.post('/api/orders', async (req, res) => {
  const { table, items, notes } = req.body || {};
  if (!table || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ ok: false, error: 'table_and_items_required' });
  }

  const db = loadDB();
  const now = new Date();
  const order = {
    id: uid(),
    time: now.toLocaleString('ar-IQ'),
    createdAt: now.toISOString(),
    table: String(table).trim(),
    items: items.map(it => ({
      name: String(it.name || '').trim(),
      qty: Number(it.qty || 0),
      price: Number(it.price || 0),
      category: String(it.category || '').trim()
    })),
    notes: String(notes || '').trim(),
    total: items.reduce((sum, it) => sum + Number(it.price || 0) * Number(it.qty || 0), 0),
    status: 'قيد التحضير',
    source: 'qr-table'
  };

  db.orders.unshift(order);
  saveDB(db);

  const telegramText = formatOrderTelegram(order);
  const telegramResult = await sendTelegramMessage(telegramText);

  res.json({
    ok: true,
    order,
    telegramSent: telegramResult.ok,
    telegram: telegramResult
  });
});

app.patch('/api/orders/:id/status', (req, res) => {
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ ok: false, error: 'status_required' });
  const db = loadDB();
  const idx = db.orders.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'order_not_found' });
  db.orders[idx].status = String(status);
  saveDB(db);
  res.json({ ok: true, order: db.orders[idx] });
});

app.get('/api/tables', (_, res) => {
  const db = loadDB();
  res.json(db.tables || []);
});

app.post('/api/tables', (req, res) => {
  const { tableNo, label } = req.body || {};
  if (!tableNo) return res.status(400).json({ ok: false, error: 'tableNo_required' });
  const db = loadDB();
  const table = {
    id: uid(),
    tableNo: String(tableNo).trim(),
    label: String(label || `Table ${tableNo}`).trim()
  };
  db.tables.unshift(table);
  saveDB(db);
  res.json({ ok: true, table });
});

app.get('/cashier', (req, res) => {
  const secret = String(req.query.secret || '');
  if (secret !== CASHIER_SECRET) {
    return res.status(401).send('Unauthorized');
  }
  res.sendFile(path.join(__dirname, 'public', 'cashier.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/api/admin/summary', (req, res) => {
  const secret = String(req.query.secret || '');
  if (secret !== CASHIER_SECRET) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  res.json(getDBSummary());
});

app.listen(PORT, () => {
  console.log(`Restaurant QR system running on http://localhost:${PORT}`);
});
