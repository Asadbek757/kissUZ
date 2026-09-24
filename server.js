const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;
const PUBLIC_URL = process.env.PUBLIC_URL || "https://kissuz.onrender.com";

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// ======================================================
// DATABASE - SIMPLE JSON STORAGE
// ======================================================

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "spinuz.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const defaultData = {
  users: {},
  tables: {},
  messages: [],
  gifts: [],
  reports: [],
  blocked: {},
  stats: {
    spins: 0,
    gifts: 0,
    likes: 0,
    messages: 0
  }
};

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
      return JSON.parse(JSON.stringify(defaultData));
    }

    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

    return {
      ...defaultData,
      ...data,
      users: data.users || {},
      tables: data.tables || {},
      messages: data.messages || [],
      gifts: data.gifts || [],
      reports: data.reports || [],
      blocked: data.blocked || {},
      stats: {
        ...defaultData.stats,
        ...(data.stats || {})
      }
    };
  } catch (error) {
    console.error("Database load error:", error);
    return JSON.parse(JSON.stringify(defaultData));
  }
}

let db = loadData();

let saveTimer = null;

function saveData() {
  clearTimeout(saveTimer);

  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
    } catch (error) {
      console.error("Database save error:", error);
    }
  }, 200);
}

// ======================================================
// HELPERS
// ======================================================

function id() {
  return crypto.randomBytes(8).toString("hex");
}

function now() {
  return new Date().toISOString();
}

function cleanText(text, max = 500) {
  if (typeof text !== "string") return "";
  return text.trim().slice(0, max);
}

function number(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function randomTable() {
  const tableIds = Object.keys(db.tables);

  if (tableIds.length === 0) {
    createTable();
  }

  const ids = Object.keys(db.tables);

  return ids[Math.floor(Math.random() * ids.length)];
}

function createTable() {
  const tableId = id();

  db.tables[tableId] = {
    id: tableId,
    players: [],
    createdAt: now()
  };

  saveData();

  return db.tables[tableId];
}

function findUser(userId) {
  return db.users[userId] || null;
}

function createUser(data = {}) {
  const userId = cleanText(data.id || id(), 100);

  if (db.users[userId]) {
    return db.users[userId];
  }

  const tableId = randomTable();

  const user = {
    id: userId,

    telegramId: data.telegramId || null,

    username: cleanText(data.username || "", 100),

    firstName: cleanText(
      data.firstName ||
      data.name ||
      "Mehmon",
      100
    ),

    age: number(data.age, 18),

    gender: data.gender === "female" ? "female" : "male",

    city: cleanText(data.city || "Toshkent", 100),

    photoUrl: cleanText(data.photoUrl || "", 500),

    coins: 100,

    vip: false,

    likes: 0,

    receivedLikes: 0,

    tableId,

    blocked: [],

    referredBy: null,

    createdAt: now(),

    lastDaily: null
  };

  db.users[userId] = user;

  if (!db.tables[tableId]) {
    createTable();
  }

  if (!db.tables[tableId].players.includes(userId)) {
    db.tables[tableId].players.push(userId);
  }

  saveData();

  return user;
}

function getUserId(req) {
  return (
    cleanText(req.headers["x-user-id"], 100) ||
    cleanText(req.body?.userId, 100) ||
    cleanText(req.query?.userId, 100) ||
    null
  );
}

function getOrCreateUser(req) {
  const existingId = getUserId(req);

  if (existingId && db.users[existingId]) {
    return db.users[existingId];
  }

  return createUser({
    id: existingId || id(),
    firstName: "Mehmon"
  });
}

function publicUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    telegramId: user.telegramId,
    username: user.username,
    firstName: user.firstName,
    age: user.age,
    gender: user.gender,
    city: user.city,
    photoUrl: user.photoUrl,
    coins: user.coins,
    vip: user.vip,
    likes: user.likes,
    receivedLikes: user.receivedLikes,
    tableId: user.tableId
  };
}

// ======================================================
// INITIAL TABLES
// ======================================================

if (Object.keys(db.tables).length === 0) {
  for (let i = 0; i < 10; i++) {
    createTable();
  }
}

// ======================================================
// DEMO USERS
// ======================================================

const demoUsers = [
  {
    id: "demo_aziza",
    firstName: "Aziza",
    age: 21,
    gender: "female",
    city: "Toshkent"
  },
  {
    id: "demo_madina",
    firstName: "Madina",
    age: 22,
    gender: "female",
    city: "Samarqand"
  },
  {
    id: "demo_malika",
    firstName: "Malika",
    age: 20,
    gender: "female",
    city: "Buxoro"
  },
  {
    id: "demo_jasur",
    firstName: "Jasur",
    age: 23,
    gender: "male",
    city: "Toshkent"
  },
  {
    id: "demo_bekzod",
    firstName: "Bekzod",
    age: 24,
    gender: "male",
    city: "Andijon"
  },
  {
    id: "demo_sardor",
    firstName: "Sardor",
    age: 22,
    gender: "male",
    city: "Namangan"
  }
];

for (const demo of demoUsers) {
  if (!db.users[demo.id]) {
    createUser(demo);
  }
}

// ======================================================
// HEALTH
// ======================================================

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "SpinUZ",
    time: now(),
    users: Object.keys(db.users).length,
    tables: Object.keys(db.tables).length
  });
});

// ======================================================
// CREATE / LOGIN USER
// ======================================================

app.post("/api/user", (req, res) => {
  try {
    const user = createUser({
      id: req.body.id,
      telegramId: req.body.telegramId,
      username: req.body.username,
      firstName: req.body.firstName,
      age: req.body.age,
      gender: req.body.gender,
      city: req.body.city,
      photoUrl: req.body.photoUrl
    });

    res.json({
      ok: true,
      user: publicUser(user)
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      error: "Foydalanuvchini yaratishda xatolik"
    });
  }
});

// ======================================================
// CURRENT USER
// ======================================================

app.get("/api/me", (req, res) => {
  const user = getOrCreateUser(req);

  res.json({
    ok: true,
    user: publicUser(user)
  });
});

// ======================================================
// UPDATE PROFILE
// ======================================================

app.put("/api/profile", (req, res) => {
  const user = getOrCreateUser(req);

  if (req.body.firstName !== undefined) {
    user.firstName = cleanText(req.body.firstName, 100) || user.firstName;
  }

  if (req.body.age !== undefined) {
    const age = number(req.body.age, user.age);

    if (age >= 18 && age <= 100) {
      user.age = age;
    }
  }

  if (req.body.gender !== undefined) {
    if (
      req.body.gender === "male" ||
      req.body.gender === "female"
    ) {
      user.gender = req.body.gender;
    }
  }

  if (req.body.city !== undefined) {
    user.city = cleanText(req.body.city, 100);
  }

  if (req.body.photoUrl !== undefined) {
    user.photoUrl = cleanText(req.body.photoUrl, 500);
  }

  saveData();

  res.json({
    ok: true,
    user: publicUser(user)
  });
});

// ======================================================
// TABLES
// ======================================================

app.get("/api/tables", (req, res) => {
  const user = getOrCreateUser(req);

  const tables = Object.values(db.tables).map(table => ({
    id: table.id,
    players: table.players
      .map(playerId => db.users[playerId])
      .filter(Boolean)
      .map(publicUser)
  }));

  res.json({
    ok: true,
    currentTable: user.tableId,
    tables
  });
});

// ======================================================
// CURRENT TABLE
// ======================================================

app.get("/api/table", (req, res) => {
  const user = getOrCreateUser(req);

  let table = db.tables[user.tableId];

  if (!table) {
    table = db.tables[randomTable()];
    user.tableId = table.id;
  }

  const players = table.players
    .map(playerId => db.users[playerId])
    .filter(Boolean)
    .map(publicUser);

  const messages = db.messages
    .filter(message => message.tableId === table.id)
    .slice(-50);

  res.json({
    ok: true,
    table: {
      id: table.id,
      players,
      messages
    }
  });
});

// ======================================================
// SWITCH TABLE
// ======================================================

app.post("/api/table/next", (req, res) => {
  const user = getOrCreateUser(req);

  const oldTable = db.tables[user.tableId];

  if (oldTable) {
    oldTable.players = oldTable.players.filter(
      playerId => playerId !== user.id
    );
  }

  let newTableId = randomTable();

  if (newTableId === user.tableId) {
    newTableId = randomTable();
  }

  if (!db.tables[newTableId]) {
    createTable();
    newTableId = randomTable();
  }

  user.tableId = newTableId;

  if (!db.tables[newTableId].players.includes(user.id)) {
    db.tables[newTableId].players.push(user.id);
  }

  saveData();

  res.json({
    ok: true,
    tableId: newTableId
  });
});

// ======================================================
// SPIN
// ======================================================

app.post("/api/spin", (req, res) => {
  const user = getOrCreateUser(req);

  const table = db.tables[user.tableId];

  if (!table) {
    return res.status(400).json({
      ok: false,
      error: "Stol topilmadi"
    });
  }

  const players = table.players
    .map(playerId => db.users[playerId])
    .filter(Boolean);

  if (players.length < 2) {
    return res.json({
      ok: false,
      error: "Spin qilish uchun stolga kamida 2 ta o'yinchi kerak"
    });
  }

  const possiblePlayers = players.filter(
    player => player.id !== user.id
  );

  const selected =
    possiblePlayers[
      Math.floor(Math.random() * possiblePlayers.length)
    ];

  db.stats.spins++;

  saveData();

  res.json({
    ok: true,
    selected: publicUser(selected),
    tableId: table.id
  });
});

// ======================================================
// TABLE CHAT
// ======================================================

app.get("/api/messages", (req, res) => {
  const user = getOrCreateUser(req);

  const tableId = req.query.tableId || user.tableId;

  const messages = db.messages
    .filter(message => message.tableId === tableId)
    .slice(-100);

  res.json({
    ok: true,
    messages
  });
});

app.post("/api/messages", (req, res) => {
  const user = getOrCreateUser(req);

  const text = cleanText(req.body.text, 500);

  if (!text) {
    return res.status(400).json({
      ok: false,
      error: "Xabar bo'sh"
    });
  }

  const message = {
    id: id(),
    tableId: user.tableId,
    userId: user.id,
    userName: user.firstName,
    text,
    createdAt: now()
  };

  db.messages.push(message);

  if (db.messages.length > 2000) {
    db.messages = db.messages.slice(-2000);
  }

  db.stats.messages++;

  saveData();

  res.json({
    ok: true,
    message
  });
});

// ======================================================
// PRIVATE CHAT
// ======================================================

app.get("/api/chat/:userId", (req, res) => {
  const user = getOrCreateUser(req);
  const otherId = cleanText(req.params.userId, 100);

  const messages = db.messages
    .filter(message => {
      return (
        message.type === "private" &&
        (
          (
            message.from === user.id &&
            message.to === otherId
          ) ||
          (
            message.from === otherId &&
            message.to === user.id
          )
        )
      );
    })
    .slice(-100);

  res.json({
    ok: true,
    messages
  });
});

app.post("/api/chat/:userId", (req, res) => {
  const user = getOrCreateUser(req);
  const otherId = cleanText(req.params.userId, 100);

  if (!db.users[otherId]) {
    return res.status(404).json({
      ok: false,
      error: "Foydalanuvchi topilmadi"
    });
  }

  const messageText = cleanText(req.body.text, 500);

  if (!messageText) {
    return res.status(400).json({
      ok: false,
      error: "Xabar bo'sh"
    });
  }

  const message = {
    id: id(),
    type: "private",
    from: user.id,
    to: otherId,
    userId: user.id,
    userName: user.firstName,
    text: messageText,
    createdAt: now()
  };

  db.messages.push(message);
  db.stats.messages++;

  saveData();

  res.json({
    ok: true,
    message
  });
});

// ======================================================
// LIKE
// ======================================================

app.post("/api/like/:userId", (req, res) => {
  const user = getOrCreateUser(req);
  const targetId = cleanText(req.params.userId, 100);

  const target = db.users[targetId];

  if (!target) {
    return res.status(404).json({
      ok: false,
      error: "Foydalanuvchi topilmadi"
    });
  }

  if (target.id === user.id) {
    return res.status(400).json({
      ok: false,
      error: "O'zingizga like bosib bo'lmaydi"
    });
  }

  user.likes++;

  target.receivedLikes++;

  db.stats.likes++;

  saveData();

  res.json({
    ok: true,
    target: publicUser(target)
  });
});

// ======================================================
// GIFT CATALOG
// ======================================================

const gifts = [
  {
    id: "rose",
    name: "Atirgul",
    category: "romantic",
    emoji: "🌹",
    price: 10
  },
  {
    id: "heart",
    name: "Yurak",
    category: "romantic",
    emoji: "❤️",
    price: 20
  },
  {
    id: "love",
    name: "Sevgi",
    category: "valuable",
    emoji: "💖",
    price: 50
  },
  {
    id: "diamond",
    name: "Olmos",
    category: "valuable",
    emoji: "💎",
    price: 100
  },
  {
    id: "laugh",
    name: "Kulgi",
    category: "funny",
    emoji: "😂",
    price: 15
  },
  {
    id: "fire",
    name: "Olov",
    category: "valuable",
    emoji: "🔥",
    price: 30
  },
  {
    id: "uzbek",
    name: "O'zbekiston",
    category: "national",
    emoji: "🇺🇿",
    price: 25
  },
  {
    id: "crown",
    name: "Toj",
    category: "valuable",
    emoji: "👑",
    price: 150
  }
];

app.get("/api/gifts", (req, res) => {
  res.json({
    ok: true,
    gifts
  });
});

// ======================================================
// SEND GIFT
// ======================================================

app.post("/api/gift/:userId", (req, res) => {
  const user = getOrCreateUser(req);

  const targetId = cleanText(req.params.userId, 100);
  const giftId = cleanText(req.body.giftId, 100);

  const target = db.users[targetId];

  const gift = gifts.find(item => item.id === giftId);

  if (!target) {
    return res.status(404).json({
      ok: false,
      error: "Foydalanuvchi topilmadi"
    });
  }

  if (!gift) {
    return res.status(404).json({
      ok: false,
      error: "Sovg'a topilmadi"
    });
  }

  if (user.coins < gift.price) {
    return res.status(400).json({
      ok: false,
      error: "Coin yetarli emas"
    });
  }

  user.coins -= gift.price;

  const giftRecord = {
    id: id(),
    from: user.id,
    to: target.id,
    giftId: gift.id,
    giftName: gift.name,
    emoji: gift.emoji,
    price: gift.price,
    createdAt: now()
  };

  db.gifts.push(giftRecord);

  db.stats.gifts++;

  saveData();

  res.json({
    ok: true,
    coins: user.coins,
    gift: giftRecord
  });
});

// ======================================================
// REPORT
// ======================================================

app.post("/api/report/:userId", (req, res) => {
  const user = getOrCreateUser(req);

  const targetId = cleanText(req.params.userId, 100);

  if (!db.users[targetId]) {
    return res.status(404).json({
      ok: false,
      error: "Foydalanuvchi topilmadi"
    });
  }

  const report = {
    id: id(),
    from: user.id,
    target: targetId,
    reason: cleanText(req.body.reason || "Boshqa", 300),
    createdAt: now(),
    status: "pending"
  };

  db.reports.push(report);

  saveData();

  res.json({
    ok: true,
    message: "Shikoyat yuborildi"
  });
});

// ======================================================
// BLOCK
// ======================================================

app.post("/api/block/:userId", (req, res) => {
  const user = getOrCreateUser(req);

  const targetId = cleanText(req.params.userId, 100);

  if (!db.users[targetId]) {
    return res.status(404).json({
      ok: false,
      error: "Foydalanuvchi topilmadi"
    });
  }

  if (!user.blocked.includes(targetId)) {
    user.blocked.push(targetId);
  }

  saveData();

  res.json({
    ok: true,
    blocked: user.blocked
  });
});

// ======================================================
// UNBLOCK
// ======================================================

app.delete("/api/block/:userId", (req, res) => {
  const user = getOrCreateUser(req);

  const targetId = cleanText(req.params.userId, 100);

  user.blocked = user.blocked.filter(
    id => id !== targetId
  );

  saveData();

  res.json({
    ok: true,
    blocked: user.blocked
  });
});

// ======================================================
// BLACKLIST
// ======================================================

app.get("/api/blacklist", (req, res) => {
  const user = getOrCreateUser(req);

  const blockedUsers = user.blocked
    .map(userId => db.users[userId])
    .filter(Boolean)
    .map(publicUser);

  res.json({
    ok: true,
    users: blockedUsers
  });
});

// ======================================================
// DATING
// ======================================================

app.get("/api/dating", (req, res) => {
  const user = getOrCreateUser(req);

  const candidates = Object.values(db.users)
    .filter(candidate => {
      if (candidate.id === user.id) return false;

      if (user.blocked.includes(candidate.id)) return false;

      if (candidate.blocked.includes(user.id)) return false;

      return true;
    })
    .sort(() => Math.random() - 0.5)
    .slice(0, 20)
    .map(publicUser);

  res.json({
    ok: true,
    users: candidates
  });
});

// ======================================================
// DAILY BONUS
// ======================================================

app.post("/api/daily", (req, res) => {
  const user = getOrCreateUser(req);

  const today = new Date().toISOString().slice(0, 10);

  if (user.lastDaily === today) {
    return res.json({
      ok: false,
      claimed: true,
      coins: user.coins,
      message: "Bugungi bonus allaqachon olingan"
    });
  }

  const reward = 100;

  user.coins += reward;
  user.lastDaily = today;

  saveData();

  res.json({
    ok: true,
    claimed: true,
    reward,
    coins: user.coins
  });
});

// ======================================================
// REFERRAL
// ======================================================

app.post("/api/referral", (req, res) => {
  const user = getOrCreateUser(req);

  const referralId = cleanText(req.body.referralId, 100);

  if (!referralId || referralId === user.id) {
    return res.status(400).json({
      ok: false,
      error: "Noto'g'ri referral"
    });
  }

  const referrer = db.users[referralId];

  if (!referrer) {
    return res.status(404).json({
      ok: false,
      error: "Referral foydalanuvchi topilmadi"
    });
  }

  if (user.referredBy) {
    return res.status(400).json({
      ok: false,
      error: "Referral allaqachon ishlatilgan"
    });
  }

  user.referredBy = referrer.id;

  user.coins += 100;

  referrer.coins += 100;

  saveData();

  res.json({
    ok: true,
    coins: user.coins,
    message: "Referral bonusi berildi"
  });
});

// ======================================================
// COIN PURCHASE - TEST
// ======================================================

const coinPackages = [
  {
    id: "coins_50",
    coins: 50,
    price: 5000
  },
  {
    id: "coins_100",
    coins: 100,
    price: 9000
  },
  {
    id: "coins_500",
    coins: 500,
    price: 40000
  },
  {
    id: "coins_1000",
    coins: 1000,
    price: 70000
  }
];

app.get("/api/shop/coins", (req, res) => {
  res.json({
    ok: true,
    packages: coinPackages
  });
});

// ======================================================
// TEST PURCHASE
// ======================================================

app.post("/api/shop/buy", (req, res) => {
  const user = getOrCreateUser(req);

  const packageId = cleanText(req.body.packageId, 100);

  const pack = coinPackages.find(
    item => item.id === packageId
  );

  if (!pack) {
    return res.status(404).json({
      ok: false,
      error: "Paket topilmadi"
    });
  }

  // TEST MODE
  // Real Click / Payme / Telegram Stars keyin ulanadi.

  user.coins += pack.coins;

  saveData();

  res.json({
    ok: true,
    testMode: true,
    addedCoins: pack.coins,
    coins: user.coins,
    message: "Test rejimida coin qo'shildi"
  });
});

// ======================================================
// VIP
// ======================================================

app.post("/api/vip/buy", (req, res) => {
  const user = getOrCreateUser(req);

  // Hozircha test rejimi
  user.vip = true;

  saveData();

  res.json({
    ok: true,
    testMode: true,
    vip: true,
    message: "VIP test rejimida yoqildi"
  });
});

// ======================================================
// LEADERBOARD
// ======================================================

app.get("/api/leaderboard", (req, res) => {
  const users = Object.values(db.users)
    .sort((a, b) => b.coins - a.coins)
    .slice(0, 100)
    .map((user, index) => ({
      rank: index + 1,
      ...publicUser(user)
    }));

  res.json({
    ok: true,
    users
  });
});

// ======================================================
// ADMIN STATISTICS
// ======================================================

app.get("/api/admin/stats", (req, res) => {
  res.json({
    ok: true,
    users: Object.keys(db.users).length,
    tables: Object.keys(db.tables).length,
    messages: db.stats.messages,
    spins: db.stats.spins,
    gifts: db.stats.gifts,
    likes: db.stats.likes,
    reports: db.reports.length
  });
});

// ======================================================
// ADMIN USERS
// ======================================================

app.get("/api/admin/users", (req, res) => {
  const users = Object.values(db.users).map(publicUser);

  res.json({
    ok: true,
    users
  });
});

// ======================================================
// ERROR HANDLER
// ======================================================

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({
      ok: false,
      error: "API endpoint topilmadi"
    });
  }

  next();
});

// ======================================================
// FRONTEND
// ======================================================

app.use(express.static(path.join(__dirname, "public")));

app.get("*", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});

// ======================================================
// START
// ======================================================

app.listen(PORT, "0.0.0.0", () => {
  console.log("=================================");
  console.log("       SpinUZ SERVER");
  console.log("=================================");
  console.log("PORT:", PORT);
  console.log("URL:", PUBLIC_URL);
  console.log("Users:", Object.keys(db.users).length);
  console.log("Tables:", Object.keys(db.tables).length);
  console.log("Server is running!");
  console.log("=================================");
});
