import express from "express";
import http from "node:http";
import { Server } from "socket.io";
import session from "express-session";
import bcrypt from "bcryptjs";
import path from "node:path";
import { redis } from "./redis-connection.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ✅ ENV PORT SUPPORT
const PORT = process.env.PORT || 8000;

// Redis Keys
const BITMAP_KEY = "checkbox_state_1m";
const OWNERS_KEY = "checkbox_owners";
const USERS_DB = "users_list";

// Middleware
app.use(express.json());
app.use(express.static("public"));

const sessionMiddleware = session({
  secret: "super-secret-key",
  resave: false,
  saveUninitialized: false,
});

app.use(sessionMiddleware);
io.engine.use(sessionMiddleware);

// ================= AUTH =================

// Register
app.post("/register", async (req, res) => {
  const { user, pass } = req.body;

  if (!user || !pass) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const exists = await redis.hget(USERS_DB, user);
  if (exists) {
    return res.status(400).json({ error: "User already exists" });
  }

  const hash = await bcrypt.hash(pass, 10);
  await redis.hset(USERS_DB, user, hash);

  res.json({ success: true });
});

// Login
app.post("/login", async (req, res) => {
  const { user, pass } = req.body;

  const hash = await redis.hget(USERS_DB, user);

  if (hash && (await bcrypt.compare(pass, hash))) {
    req.session.user = user;
    return res.json({ success: true });
  }

  res.status(401).json({ error: "Invalid credentials" });
});

// Logout
app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Logout failed" });
    }

    res.clearCookie("connect.sid");
    res.json({ success: true });
  });
});

// ================= CHECKBOX API =================

// Fetch 1000 checkboxes
app.get("/checkboxes/:offset", async (req, res) => {
  const offset = parseInt(req.params.offset);
  const bits = [];

  for (let i = 0; i < 1000; i++) {
    bits.push(await redis.getbit(BITMAP_KEY, offset + i));
  }

  res.json({ bits });
});

// ================= SOCKET =================

io.on("connection", (socket) => {
  // Send user info on connect
  socket.emit("server:user", socket.request.session.user || null);

  socket.on("client:checkbox:change", async ({ index }) => {
    const session = socket.request.session;

    // ✅ 1. Check login
    if (!session.user) {
      return socket.emit("server:error", "Login required!");
    }

    // 🚀 ADD RATE LIMITING HERE
    const rateLimitKey = `rate_limit:${session.user}`;
    const limit = 10; // Max 10 clicks
    const windowSeconds = 10; // Every 10 seconds

    const currentUsage = await redis.incr(rateLimitKey);
    if (currentUsage === 1) {
      await redis.expire(rateLimitKey, windowSeconds);
    }

    if (currentUsage > limit) {
      return socket.emit("server:error", "Spam detected! Wait a few seconds.");
    }

    // ✅ 2. LIMIT CHECK HERE
    if (typeof index !== "number" || index < 0 || index >= 1000000) {
      return socket.emit("server:error", "Invalid index!");
    }

    // ✅ 3. Then continue normal logic
    const exists = await redis.getbit(BITMAP_KEY, index);

    if (exists) {
      return socket.emit("server:error", "Already claimed!");
    }

    await redis.setbit(BITMAP_KEY, index, 1);
    await redis.hset(OWNERS_KEY, index, session.user);

    io.emit("server:checkbox:change", {
      index,
      checked: true,
      owner: session.user,
    });
  });
});

// Start Server
server.listen(PORT, () => {
  console.log(`🚀 Running on http://localhost:${PORT}`);
});
