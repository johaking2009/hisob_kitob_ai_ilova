const { Telegraf, Markup, session } = require('telegraf');
require('dotenv').config();
const db = require('./db');

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error("Xatolik: BOT_TOKEN topilmadi! .env faylini tekshiring.");
  process.exit(1);
}

const bot = new Telegraf(token);

// Set Telegram left-side menu commands
bot.telegram.setMyCommands([
  { command: 'start', description: '📊 Bosh sahifa va statistika' },
  { command: 'balance', description: '💳 Mening balansim' },
  { command: 'taken_debts', description: '🔴 Qarzdorliklarim (Olingan qarz)' },
  { command: 'given_debts', description: '🟢 Berilgan qarzlar' },
  { command: 'add_debt', description: "➕ Qarz qo'shish" },
  { command: 'set_balance', description: '💰 Balansni yangilash' },
  { command: 'help', description: 'ℹ️ Yordam' }
]).catch(err => console.error("Menu commands setup error:", err));

// Middleware for session state handling
bot.use(session());

// Helper state reset
function resetState(ctx) {
  if (!ctx.session) ctx.session = {};
  ctx.session.step = null;
  ctx.session.debtType = null;
  ctx.session.personName = null;
  ctx.session.amount = null;
}

// Asosiy Menyu tugmalari
function getMainMenuKeyboard(webAppUrl) {
  const buttons = [
    ['💳 Mening balansim', '📊 Bosh sahifa'],
    ['🔴 Qarzdorliklarim', '🟢 Berilgan qarzlar'],
    ["➕ Qarz qo'shish", '💰 Balansni yangilash'],
    ['ℹ️ Yordam']
  ];

  if (webAppUrl) {
    buttons.unshift([Markup.button.webApp('📱 Ilovani ochish (Web App)', webAppUrl)]);
  }

  return Markup.keyboard(buttons).resize().persistent();
}

// Summary message generator
async function sendSummaryMessage(ctx, customText = '') {
  const userId = ctx.from.id;
  const summary = await db.getFinancialSummary(userId);

  const text = (customText ? customText + '\n\n' : '') +
    `📌 *HISOBOINGIZ VA STATISTIKA*\n` +
    `─────────────\n` +
    `💳 *Mening balansim:* ${db.formatMoney(summary.balance)}\n` +
    `🔴 *Qarzdorlik (Olingan):* ${db.formatMoney(summary.totalTaken)}\n` +
    `🟢 *Berilgan qarz:* ${db.formatMoney(summary.totalGiven)}\n` +
    `─────────────\n` +
    `📊 *Sof balans (Jami):* ${db.formatMoney(summary.netBalance)}\n\n` +
    `👇 Kerakli bo'limni tanlang:`;

  const webAppUrl = process.env.WEB_APP_URL || '';
  return ctx.replyWithMarkdown(text, getMainMenuKeyboard(webAppUrl));
}

// /start buyrug'i
bot.start(async (ctx) => {
  resetState(ctx);
  const name = ctx.from.first_name || 'Foydalanuvchi';
  const welcomeText = `Assalomu aleykum, *${name}*!\n\n👋 "Hisob-Kitob" botiga xush kelibsiz. Bot orqali balansingiz va qarzlaringizni qulay hisoblab borishingiz mumkin.`;
  await sendSummaryMessage(ctx, welcomeText);
});

// Bosh sahifa buyrug'i
bot.hears(['📊 Bosh sahifa', '/summary', 'Bosh sahifa'], async (ctx) => {
  resetState(ctx);
  await sendSummaryMessage(ctx);
});

// Mening balansim
bot.hears(['💳 Mening balansim', '/balance'], async (ctx) => {
  resetState(ctx);
  const userId = ctx.from.id;
  const summary = await db.getFinancialSummary(userId);

  const text = `💳 *Mening balansim:* ${db.formatMoney(summary.balance)}\n\nBalansni o'zgartirish uchun tugmani bosing yoki menyudan "💰 Balansni yangilash" tugmasini tanlang.`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback("💰 Balansni o'zgartirish", 'action_update_balance')],
    [Markup.button.callback('🔙 Orqaga', 'action_main_menu')]
  ]);

  await ctx.replyWithMarkdown(text, keyboard);
});

// Qarzdorliklarim (Olingan qarzlar - men berishim kerak bo'lgan)
bot.hears(['🔴 Qarzdorliklarim', '/taken_debts'], async (ctx) => {
  resetState(ctx);
  await showDebtsList(ctx, 'taken');
});

// Berilgan qarzlar (boshqalar menga berishi kerak bo'lgan)
bot.hears(['🟢 Berilgan qarzlar', '/given_debts'], async (ctx) => {
  resetState(ctx);
  await showDebtsList(ctx, 'given');
});

// Debts list display helper
async function showDebtsList(ctx, type) {
  try {
    const userId = ctx.from.id;
    const debts = await db.getDebts(userId, type, 0);
    const isTaken = type === 'taken';
    const title = isTaken ? '🔴 QARZDORLIKLARIM (Olingan qarzlar)' : '🟢 BERILGAN QARZLAR';

    if (debts.length === 0) {
      const emptyText = `${title}\n\nSizda hozircha aktiv ${isTaken ? 'qarzdorliklar' : 'berilgan qarzlar'} mavjud emas.`;
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(isTaken ? "➕ Qarzdorlik qo'shish" : '➕ Qarz berish', `action_add_debt_${type}`)]
      ]);
      if (ctx.callbackQuery) {
        return ctx.editMessageText(emptyText, keyboard);
      }
      return ctx.reply(emptyText, keyboard);
    }

    let total = 0;
    let text = `${title}\n\n`;

    const inlineButtons = [];

    debts.forEach((debt, idx) => {
      total += debt.amount;
      const commentStr = debt.comment ? ` (${debt.comment})` : '';
      text += `${idx + 1}. ${debt.person_name}: ${db.formatMoney(debt.amount)}${commentStr}\n`;

      inlineButtons.push([
        Markup.button.callback(`✅ ${debt.person_name} (${db.formatMoney(debt.amount)}) yopish`, `pay_debt_${debt.id}`),
        Markup.button.callback('❌', `delete_debt_${debt.id}`)
      ]);
    });

    text += `\n─────────────\nJami summasi: ${db.formatMoney(total)}`;

    inlineButtons.push([
      Markup.button.callback(isTaken ? "➕ Yana qarzdorlik qo'shish" : '➕ Yana qarz berish', `action_add_debt_${type}`)
    ]);

    const keyboard = Markup.inlineKeyboard(inlineButtons);

    if (ctx.callbackQuery) {
      return ctx.editMessageText(text, keyboard);
    }
    return ctx.reply(text, keyboard);
  } catch (err) {
    console.error("showDebtsList error:", err);
    return ctx.reply("⚠️ Ma'lumotlarni yuklashda xatolik yuz berdi. Iltimos qaytadan /start bosing.");
  }
}

// Qarz qo'shish tanlovi
bot.hears(["➕ Qarz qo'shish", '/add_debt'], async (ctx) => {
  resetState(ctx);
  const text = `➕ *QARZ QO'SHISH*\n\nQaysi turdagi qarzni kiritmoqchisiz?`;
  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('🔴 Qarzdorlik (Olingan qarz)', 'action_add_debt_taken'),
      Markup.button.callback('🟢 Berilgan qarz', 'action_add_debt_given')
    ]
  ]);
  await ctx.replyWithMarkdown(text, keyboard);
});

// Balansni yangilash
bot.hears(['💰 Balansni yangilash', '/set_balance'], async (ctx) => {
  resetState(ctx);
  ctx.session.step = 'awaiting_balance';
  await ctx.replyWithMarkdown(
    `💰 *Yangi balans summasini kiriting:*\n\nMasalan: \`1500000\` yoki \`2 500 000\`\n\n_Bekor qilish uchun /cancel_`
  );
});

// Help / Yordam
bot.hears(['ℹ️ Yordam', '/help'], async (ctx) => {
  resetState(ctx);
  const helpText = `ℹ️ *YORDAM VA BOTDAN FOYDALANISH*\n\n` +
    `• *Mening balansim* - Hozirgi hamyoningiz yoki kartangizdagi naqd pulingiz.\n` +
    `• *Qarzdorliklarim* - Boshqalardan olgan va berishingiz kerak bo'lgan qarzlar.\n` +
    `• *Berilgan qarzlar* - Boshqalarga bergan va sizga qaytarilishi kerak bo'lgan pul.\n` +
    `• *Qarzni yopish* - Ro'yxatdagi "✅ yopish" tugmasini bosing.\n\n` +
    `Savollar bo'lsa, qayta /start bosing.`;
  await ctx.replyWithMarkdown(helpText);
});

// Cancel command
bot.command('cancel', async (ctx) => {
  resetState(ctx);
  await ctx.reply('❌ Amaliyot bekor qilindi.');
  await sendSummaryMessage(ctx);
});

// Callback Queries (Inline buttons)
bot.action('action_main_menu', async (ctx) => {
  await ctx.answerCbQuery();
  resetState(ctx);
  await sendSummaryMessage(ctx);
});

bot.action('action_update_balance', async (ctx) => {
  await ctx.answerCbQuery();
  resetState(ctx);
  ctx.session.step = 'awaiting_balance';
  await ctx.replyWithMarkdown(`💰 *Yangi balans summasini kiriting:*\n\n_Bekor qilish uchun /cancel_`);
});

bot.action(/action_add_debt_(taken|given)/, async (ctx) => {
  await ctx.answerCbQuery();
  const type = ctx.match[1];
  ctx.session.step = 'awaiting_person_name';
  ctx.session.debtType = type;

  const title = type === 'taken' ? '🔴 Qarzdorlik (Olingan qarz)' : '🟢 Berilgan qarz';
  await ctx.replyWithMarkdown(
    `📝 *${title}*\n\n*1-bosqich:* Kimdan/Kimga? (Odam yoki tashkilot ismini kiriting):\n\n_Masalan: Ali, Valijon, Do'kon_`
  );
});

// Pay debt callback
bot.action(/pay_debt_(\d+)/, async (ctx) => {
  const debtId = parseInt(ctx.match[1]);
  const userId = ctx.from.id;
  const debt = await db.markDebtPaid(debtId, userId);
  if (debt) {
    await ctx.answerCbQuery('✅ Qarz yopildi deb belgilandi!');
    await showDebtsList(ctx, debt.type);
  } else {
    await ctx.answerCbQuery('Xatolik: Qarz topilmadi.');
  }
});

// Delete debt callback
bot.action(/delete_debt_(\d+)/, async (ctx) => {
  const debtId = parseInt(ctx.match[1]);
  const userId = ctx.from.id;
  const debt = await db.getDebtById(debtId, userId);
  if (debt) {
    await db.deleteDebt(debtId, userId);
    await ctx.answerCbQuery("🗑 Qarz o'chirildi.");
    await showDebtsList(ctx, debt.type);
  } else {
    await ctx.answerCbQuery('Xatolik: Topilmadi.');
  }
});

// Step-by-step text message handler
bot.on('text', async (ctx, next) => {
  const step = ctx.session ? ctx.session.step : null;
  const text = ctx.message.text.trim();

  // If user clicked a menu button or command, clear step
  if (text.startsWith('/') || ['💳 Mening balansim', '🔴 Qarzdorliklarim', '🟢 Berilgan qarzlar', "➕ Qarz qo'shish", '💰 Balansni yangilash', '📊 Bosh sahifa', 'ℹ️ Yordam'].includes(text)) {
    return next();
  }

  // 1. Awaiting Balance input
  if (step === 'awaiting_balance') {
    const cleanNum = text.replace(/\s+/g, '').replace(/,/g, '.');
    const amount = parseFloat(cleanNum);

    if (isNaN(amount) || amount < 0) {
      return ctx.reply("⚠️ Iltimos, to'g'ri raqam kiriting (Masalan: 1500000):");
    }

    const userId = ctx.from.id;
    await db.updateBalance(userId, amount);
    resetState(ctx);

    await ctx.replyWithMarkdown(`✅ *Balansingiz muvaffaqiyatli yangilandi:* ${db.formatMoney(amount)}`);
    return sendSummaryMessage(ctx);
  }

  // 2. Awaiting Person Name for debt
  if (step === 'awaiting_person_name') {
    if (!ctx.session) ctx.session = {};
    ctx.session.personName = text;
    ctx.session.step = 'awaiting_amount';

    const type = ctx.session.debtType || 'given';
    const title = type === 'taken' ? 'Qarzdorlik summasi' : 'Berilgan qarz summasi';
    return ctx.replyWithMarkdown(
      `👤 Shaxs: *${text}*\n\n*2-bosqich:* ${title}ni kiriting (so'mda):\n\n_Masalan: 500000_`
    );
  }

  // 3. Awaiting Amount for debt
  if (step === 'awaiting_amount') {
    const cleanNum = text.replace(/\s+/g, '').replace(/,/g, '.');
    const amount = parseFloat(cleanNum);

    if (isNaN(amount) || amount <= 0) {
      return ctx.reply("⚠️ Iltimos, noldan katta to'g'ri summa kiriting (Masalan: 500000):");
    }

    if (!ctx.session) ctx.session = {};
    ctx.session.amount = amount;
    ctx.session.step = 'awaiting_comment';

    return ctx.replyWithMarkdown(
      `💰 Summa: *${db.formatMoney(amount)}*\n\n*3-bosqich:* Izoh yoki sababini kiriting (ixtiyoriy, o'tkazib yuborish uchun '-' deb yozing):`
    );
  }

  // 4. Awaiting Comment for debt
  if (step === 'awaiting_comment') {
    const lowerText = text.toLowerCase();
    const comment = (text === '-' || lowerText === "yo'q" || lowerText === 'no') ? '' : text;
    const userId = ctx.from.id;

    const sessionData = ctx.session || {};
    const debtType = sessionData.debtType || 'given';
    const personName = sessionData.personName || 'Noma\'lum';
    const amount = sessionData.amount || 0;

    await db.addDebt(userId, debtType, personName, amount, comment);

    const typeTitle = debtType === 'taken' ? '🔴 Qarzdorlik (Olingan qarz)' : '🟢 Berilgan qarz';
    resetState(ctx);

    await ctx.replyWithMarkdown(
      `✅ *Muvaffaqiyatli saqlandi!*\n\n` +
      `📌 *Turi:* ${typeTitle}\n` +
      `👤 *Ism:* ${personName}\n` +
      `💰 *Summa:* ${db.formatMoney(amount)}\n` +
      (comment ? `📝 *Izoh:* ${comment}\n` : '')
    );

    return showDebtsList(ctx, debtType);
  }

  return next();
});

// Error handling
bot.catch((err, ctx) => {
  console.error(`Bot xatoligi (${ctx.updateType}):`, err);
  ctx.reply("⚠️ Tizimda kutilmagan xatolik yuz berdi. Iltimos qaytadan urinib ko'ring.");
});

module.exports = bot;
