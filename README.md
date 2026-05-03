# 1 Million Checkboxes Challenge

A real-time, high-scale web application where users can claim checkboxes on a shared grid of 1 million units. This project demonstrates distributed state management, real-time synchronization, and custom security scaling.

## 🚀 Tech Stack

- **Frontend:** HTML5, CSS3 (Custom Properties & Glassmorphism), Vanilla JavaScript.
- **Backend:** Node.js, Express.js.
- **Real-time:** Socket.io.
- **Database/Coordination:** Valkey (Redis) using Bitmaps and Hashes.
- **DevOps:** Docker Compose.

---

## ✨ Features Implemented

- **Compact State Storage:** Uses a Redis Bitmap to store 1,000,000 states in just ~125KB of memory.
- **Infinite Scroll:** Frontend fetches checkbox data in chunks of 1,000 to maintain high performance.
- **Real-time Sync:** All connected users see updates instantly via WebSockets.
- **Custom Rate Limiting:** A sliding-window logic prevents spam clicks without using external libraries.
- **Secure Authentication:** Session-based authentication with Bcrypt password hashing.
- **Responsive Design:** Fully mobile-friendly grid layout.

---

## 🛠 How to Run Locally

### Prerequisites
- Node.js (v18+)
- Docker & Docker Compose

### 1. Clone the repository
```bash
git clone <your-repo-link>
cd checkboxes
```

### 2. Start Redis (Valkey)
```bash
docker-compose up -d
```

### 3. Install Dependencies
```bash
pnpm install
```

### 4. Setup Environment Variables
Create a `.env` file (see `.env.example`):
```text
PORT=8000
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
SESSION_SECRET=super-secret-key
```

### 5. Run the Server
```bash
node index.js
```
Open `http://localhost:8000` in your browser.

---

## 🧠 System Design Explanation

### 1. Redis State Management
Instead of storing 1 million rows in a SQL database, I used a **Redis Bitmap** (`BITSET`/`GETBIT`). This allows for $O(1)$ time complexity for toggling and minimal memory usage. User ownership is tracked via a **Redis Hash** mapping indices to usernames.

### 2. Custom Rate Limiting Logic
To prevent bot abuse, I implemented a manual limit using Redis:
- **Key:** `rate_limit:{username}`
- **Logic:** Each click increments a counter. On the first click, a 10-second expiry is set. If the counter exceeds 10 within that window, the WebSocket emits an error and blocks the database write.

### 3. WebSocket Flow
1. **Client** clicks a checkbox -> Sends `client:checkbox:change` with index.
2. **Server** validates the session -> checks Rate Limit -> checks if already claimed.
3. **Server** updates Redis Bitmap and Hash.
4. **Server** broadcasts `server:checkbox:change` to **all** connected clients via `io.emit`.

### 4. Auth Flow
Authentication is handled via Express sessions. Only logged-in users can emit checkbox changes. Anonymous users are granted "Read-Only" access; they can see the grid but receive a "Login Required" notification if they attempt to interact.

---

## 📺 Demo
- **Live Link:** https://webcheckbox.rupeshpradhan.com/
- **YouTube Demo:** [My yt Link]
