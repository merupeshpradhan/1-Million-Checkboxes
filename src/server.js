require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { client, subscriber, connectRedis } = require('./redisClient');
const { isRateLimited } = require('./rateLimiter');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Redis Pub/Sub: Listen for updates from other server instances
subscriber.subscribe('checkbox_updates', (message) => {
    const { index, value } = JSON.parse(message);
    io.emit('update', { index, value }); // Send to all connected browser clients
});

io.on('connection', async (socket) => {
    console.log('User connected:', socket.id);

    // 1. Send the full 1 million state to the user on join
    // For now, we'll send a "Ready" signal. 
    // (Later we will optimize this for the 1 million boxes)
    socket.emit('init', { message: "Welcome to the Grid!" });

    // 2. Handle checkbox toggle events
    socket.on('toggle', async (data) => {
        const { index, value } = data;
        const userId = socket.id; // Using socket.id as a simple ID for now

        // 3. Apply Custom Rate Limiting
        const limited = await isRateLimited(userId);
        if (limited) {
            return socket.emit('error', { message: 'Too fast! Slow down.' });
        }

        // 4. Update the Bitmap in Redis
        await client.setBit('checkbox_grid', index, value ? 1 : 0);

        // 5. Broadcast change via Redis Pub/Sub
        const updatePayload = JSON.stringify({ index, value });
        await client.publish('checkbox_updates', updatePayload);
    });
});

const PORT = process.env.PORT || 3000;
connectRedis().then(() => {
    server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
});
