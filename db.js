const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'hisob_kitob.db');
const db = new sqlite3.Database(dbPath);

// Database initialization
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY,
      balance REAL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS debts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL, -- 'taken' (Qarzdorlik) or 'given' (Berilgan qarz)
      person_name TEXT NOT NULL,
      amount REAL NOT NULL,
      comment TEXT DEFAULT '',
      is_paid INTEGER DEFAULT 0, -- 0: Ochiq, 1: Yopilgan
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      paid_at DATETIME
    )
  `);
});

// Helper wrapper for async database queries
function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// User & Balance management
async function getUser(userId) {
  let user = await getAsync('SELECT * FROM users WHERE user_id = ?', [userId]);
  if (!user) {
    await runAsync('INSERT INTO users (user_id, balance) VALUES (?, 0)', [userId]);
    user = { user_id: userId, balance: 0 };
  }
  return user;
}

async function updateBalance(userId, newBalance) {
  await getUser(userId);
  await runAsync(
    'UPDATE users SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
    [newBalance, userId]
  );
  return newBalance;
}

async function addBalanceDelta(userId, delta) {
  const user = await getUser(userId);
  const updatedBalance = (user.balance || 0) + delta;
  await updateBalance(userId, updatedBalance);
  return updatedBalance;
}

// Debt management
async function addDebt(userId, type, personName, amount, comment = '') {
  await getUser(userId);
  const result = await runAsync(
    `INSERT INTO debts (user_id, type, person_name, amount, comment) VALUES (?, ?, ?, ?, ?)`,
    [userId, type, personName, amount, comment]
  );
  return result.lastID;
}

async function getDebts(userId, type = null, isPaid = 0) {
  let sql = 'SELECT * FROM debts WHERE user_id = ? AND is_paid = ?';
  const params = [userId, isPaid];
  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }
  sql += ' ORDER BY id DESC';
  return await allAsync(sql, params);
}

async function getDebtById(debtId, userId) {
  return await getAsync('SELECT * FROM debts WHERE id = ? AND user_id = ?', [debtId, userId]);
}

async function markDebtPaid(debtId, userId) {
  const debt = await getDebtById(debtId, userId);
  if (!debt) return null;

  await runAsync(
    'UPDATE debts SET is_paid = 1, paid_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
    [debtId, userId]
  );
  return debt;
}

async function deleteDebt(debtId, userId) {
  return await runAsync('DELETE FROM debts WHERE id = ? AND user_id = ?', [debtId, userId]);
}

// Financial summary calculator
async function getFinancialSummary(userId) {
  const user = await getUser(userId);
  const balance = user.balance || 0;

  const takenRow = await getAsync(
    'SELECT SUM(amount) as total FROM debts WHERE user_id = ? AND type = "taken" AND is_paid = 0',
    [userId]
  );
  const totalTaken = takenRow && takenRow.total ? takenRow.total : 0;

  const givenRow = await getAsync(
    'SELECT SUM(amount) as total FROM debts WHERE user_id = ? AND type = "given" AND is_paid = 0',
    [userId]
  );
  const totalGiven = givenRow && givenRow.total ? givenRow.total : 0;

  const netBalance = balance + totalGiven - totalTaken;

  return {
    balance,
    totalTaken,
    totalGiven,
    netBalance
  };
}

// Format numbers into Uzbek readable money string (e.g. 1 500 000 so'm)
function formatMoney(amount) {
  if (amount === undefined || amount === null) return '0 so\'m';
  const formatted = Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${formatted} so'm`;
}

module.exports = {
  getUser,
  updateBalance,
  addBalanceDelta,
  addDebt,
  getDebts,
  getDebtById,
  markDebtPaid,
  deleteDebt,
  getFinancialSummary,
  formatMoney
};
