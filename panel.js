
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// سرویس فایل‌های استاتیک
app.use(express.static('public'));
app.use(express.json());

// وضعیت ربات
let botStatus = {
    connected: false,
    qaCount: 0,
    lastUpdate: 'هنوز متصل نشده'
};

// تابع برای آپدیت وضعیت از ربات
function updateBotStatus(status) {
    botStatus = { ...botStatus, ...status };
    io.emit('statusUpdate', botStatus); // ارسال به همه کلاینت‌ها
}

// API برای گرفتن وضعیت ربات
app.get('/api/status', (req, res) => {
    res.json(botStatus);
});

// روت اصلی
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// راه‌اندازی سرور
server.listen(3000, () => {
    console.log('🌐 پنل مدیریت در حال اجرا: http://localhost:3000');
});

// صادر کردن تابع برای استفاده در index.js
module.exports = { updateBotStatus };