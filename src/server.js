require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const axios = require("axios");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const { client, subscriber, connectRedis } = require("./redisClient");
const { isRateLimited } = require("./rateLimiter");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));
app.use(cookieParser());

// --- AUTH LOGIC ---

// 1. Redirect to GitHub (FIXED URL)
app.get("/login", (req, res) => {
  // const url = `https://github.com{process.env.GITHUB_CLIENT_ID}&scope=user`;
  const url = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&scope=user`;
  res.redirect(url);
});

// 2. GitHub Callback (FIXED ENDPOINTS)
app.get("/auth/github/callback", async (req, res) => {
  const { code } = req.query;
  try {
    // Exchange code for token (FIXED URL)
    const tokenRes = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      { headers: { Accept: "application/json" } },
    );

    const accessToken = tokenRes.data.access_token;

    // Get User Info (FIXED URL: ://github.com)
    const userRes = await axios.get("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // Create our own JWT
    const token = jwt.sign(
      { id: userRes.data.id, name: userRes.data.login },
      process.env.JWT_SECRET,
    );

    // Store token in a cookie
    res.cookie("token", token, { httpOnly: true });
    res.redirect("/");
  } catch (err) {
    console.error("Login Error:", err.message);
    res.send("Login failed: " + err.message);
  }
});

// --- WEBSOCKET LOGIC ---

// Listen for updates from Redis and send to all browser clients
subscriber.subscribe("checkbox_updates", (msg) => {
  io.emit("update", JSON.parse(msg));
});

io.on("connection", (socket) => {
  const cookieString = socket.handshake.headers.cookie;
  let user = null;

  if (cookieString) {
    const match = cookieString.match(/token=([^;]+)/);
    const token = match ? match[1] : null;
    if (token) {
      try {
        user = jwt.verify(token, process.env.JWT_SECRET);
        console.log(`User connected: ${user.name}`);
      } catch (e) {
        console.log("JWT Verification failed");
      }
    }
  }

  socket.on("toggle", async (data) => {
    // Validation
    if (!user) return socket.emit("error", { message: "Please Login First!" });

    // Rate Limiting
    if (await isRateLimited(user.id)) {
      return socket.emit("error", { message: "Too fast! Slow down." });
    }

    // Save to Redis Bitmap
    await client.setBit("checkbox_grid", data.index, data.value ? 1 : 0);

    // Broadcast to other users via Redis Pub/Sub
    await client.publish("checkbox_updates", JSON.stringify(data));
  });
});

// Start Server
connectRedis().then(() => {
  server.listen(3000, () =>
    console.log("🚀 Server running at http://localhost:3000"),
  );
});
