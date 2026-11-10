<<<<<<< HEAD
const express = require('express');
const path = require('path');
const cors = require('cors');
const os = require('os');
require('dotenv').config();

const db = require('./db');
const bot = require('./bot');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper to detect local IPv4 address
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// API Routes
app.get('/api/summary/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const summary = await db.getFinancialSummary(userId);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/debts/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const type = req.query.type || null;
    const debts = await db.getDebts(userId, type, 0);
    res.json(debts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/balance', async (req, res) => {
  try {
    const { userId, balance } = req.body;
    await db.updateBalance(userId, balance);

    // Send notification to user's Telegram chat
    if (userId && bot) {
      const formatted = db.formatMoney(balance);
      bot.telegram.sendMessage(userId, `📱 *Ilovadan balans yangilandi:*\n💳 Yangi balans: ${formatted}`, { parse_mode: 'Markdown' })
        .catch(err => console.error("Telegram msg error:", err.message));
    }

    res.json({ success: true, balance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/debt', async (req, res) => {
  try {
    const { userId, type, personName, amount, comment } = req.body;
    const debtId = await db.addDebt(userId, type, personName, amount, comment);

    // Send notification to user's Telegram chat
    if (userId && bot) {
      const typeTitle = type === 'taken' ? '🔴 Qarzdorlik (Olingan qarz)' : '🟢 Berilgan qarz';
      const formatted = db.formatMoney(amount);
      const commentText = comment ? `\n📝 Izoh: ${comment}` : '';

      const text = `📱 *Ilovadan yangi qarz saqlandi:*\n📌 Turi: ${typeTitle}\n👤 Ism: ${personName}\n💰 Summa: ${formatted}${commentText}`;
      bot.telegram.sendMessage(userId, text, { parse_mode: 'Markdown' })
        .catch(err => console.error("Telegram msg error:", err.message));
    }

    res.json({ success: true, debtId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/debt/pay', async (req, res) => {
  try {
    const { userId, debtId } = req.body;
    const debt = await db.markDebtPaid(debtId, userId);

    // Send notification to user's Telegram chat
    if (userId && debt && bot) {
      const formatted = db.formatMoney(debt.amount);
      bot.telegram.sendMessage(userId, `📱 *Ilovadan qarz yopildi:*\n👤 ${debt.person_name}: ${formatted}`, { parse_mode: 'Markdown' })
        .catch(err => console.error("Telegram msg error:", err.message));
    }

    res.json({ success: true, debt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Express Server
app.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIpAddress();
  console.log(`\n==================================================`);
  console.log(`🌐 Express Server 0.0.0.0:${PORT} manzilida ishga tushdi!`);
  console.log(`📱 Telefondagi ilovada sozlashingiz kerak bo'lgan manzil:`);
  console.log(`👉 http://${localIp}:${PORT}`);
  console.log(`==================================================\n`);
});

// Start Telegram Bot
console.log("🤖 Telegram Bot ishga tushirilmoqda...");
bot.launch({ dropPendingUpdates: true })
  .then(() => {
    console.log(`🤖 Telegram Bot muvaffaqiyatli ishga tushdi!`);
  })
  .catch((err) => {
    console.error("❌ Botni ishga tushirishda xatolik:", err);
  });

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
=======
const express = require('express');
const path = require('path');
const cors = require('cors');
const os = require('os');
require('dotenv').config();

const db = require('./db');
const bot = require('./bot');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper to detect local IPv4 address
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// API Routes
app.get('/api/summary/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const summary = await db.getFinancialSummary(userId);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/debts/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const type = req.query.type || null;
    const debts = await db.getDebts(userId, type, 0);
    res.json(debts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/balance', async (req, res) => {
  try {
    const { userId, balance } = req.body;
    await db.updateBalance(userId, balance);

    // Send notification to user's Telegram chat
    if (userId && bot) {
      const formatted = db.formatMoney(balance);
      bot.telegram.sendMessage(userId, `📱 *Ilovadan balans yangilandi:*\n💳 Yangi balans: ${formatted}`, { parse_mode: 'Markdown' })
        .catch(err => console.error("Telegram msg error:", err.message));
    }

    res.json({ success: true, balance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/debt', async (req, res) => {
  try {
    const { userId, type, personName, amount, comment } = req.body;
    const debtId = await db.addDebt(userId, type, personName, amount, comment);

    // Send notification to user's Telegram chat
    if (userId && bot) {
      const typeTitle = type === 'taken' ? '🔴 Qarzdorlik (Olingan qarz)' : '🟢 Berilgan qarz';
      const formatted = db.formatMoney(amount);
      const commentText = comment ? `\n📝 Izoh: ${comment}` : '';

      const text = `📱 *Ilovadan yangi qarz saqlandi:*\n📌 Turi: ${typeTitle}\n👤 Ism: ${personName}\n💰 Summa: ${formatted}${commentText}`;
      bot.telegram.sendMessage(userId, text, { parse_mode: 'Markdown' })
        .catch(err => console.error("Telegram msg error:", err.message));
    }

    res.json({ success: true, debtId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/debt/pay', async (req, res) => {
  try {
    const { userId, debtId } = req.body;
    const debt = await db.markDebtPaid(debtId, userId);

    // Send notification to user's Telegram chat
    if (userId && debt && bot) {
      const formatted = db.formatMoney(debt.amount);
      bot.telegram.sendMessage(userId, `📱 *Ilovadan qarz yopildi:*\n👤 ${debt.person_name}: ${formatted}`, { parse_mode: 'Markdown' })
        .catch(err => console.error("Telegram msg error:", err.message));
    }

    res.json({ success: true, debt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Express Server
app.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIpAddress();
  console.log(`\n==================================================`);
  console.log(`🌐 Express Server 0.0.0.0:${PORT} manzilida ishga tushdi!`);
  console.log(`📱 Telefondagi ilovada sozlashingiz kerak bo'lgan manzil:`);
  console.log(`👉 http://${localIp}:${PORT}`);
  console.log(`==================================================\n`);
});

// Start Telegram Bot
console.log("🤖 Telegram Bot ishga tushirilmoqda...");
bot.launch({ dropPendingUpdates: true })
  .then(() => {
    console.log(`🤖 Telegram Bot muvaffaqiyatli ishga tushdi!`);
  })
  .catch((err) => {
    console.error("❌ Botni ishga tushirishda xatolik:", err);
  });

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
>>>>>>> f86593fb2b5171f5204d21b7e36d2b6bb4305430
