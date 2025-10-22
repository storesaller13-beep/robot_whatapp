const { default: makeWASocket, useMultiFileAuthState, delay } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

console.log('🚀 راه‌اندازی ربات هوشمند...');

// متغیرهای کش و مدیریت
let knowledgeBaseCache = null;
let lastCacheUpdate = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 ساعت
let lastProcessedMessages = new Map();
const MESSAGE_COOLDOWN = 2000; // 2 ثانیه
let lastFileSize = 0;
let lastFileModified = 0;
const FILE_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 ساعت

// تابع جدید برای بررسی تغییرات فایل
function checkFileChanges() {
    try {
        const dataPath = path.join(__dirname, 'data.txt');
        if (fs.existsSync(dataPath)) {
            const stats = fs.statSync(dataPath);
            const currentSize = stats.size;
            const currentModified = stats.mtimeMs;
            
            // اگر فایل تغییر کرده
            if (currentSize !== lastFileSize || currentModified !== lastFileModified) {
                console.log('🔄 تغییر در فایل data.txt تشخیص داده شد');
                knowledgeBaseCache = null; // پاک کردن کش برای بارگذاری مجدد
                loadKnowledgeBase(); // بارگذاری مجدد
                
                lastFileSize = currentSize;
                lastFileModified = currentModified;
            }
        }
    } catch (error) {
        console.log('⚠️ خطا در بررسی تغییرات فایل:', error.message);
    }
}

// تابع برای خواندن دانش ربات
function loadKnowledgeBase() {
    const now = Date.now();
    
    // اگر کش معتبر هست، ازش استفاده کن
    if (knowledgeBaseCache && (now - lastCacheUpdate) < CACHE_DURATION) {
        return knowledgeBaseCache;
    }
    
    try {
        const dataPath = path.join(__dirname, 'data.txt');
        if (fs.existsSync(dataPath)) {
            const content = fs.readFileSync(dataPath, 'utf8');
            console.log('✅ فایل دانش با موفقیت خوانده شد');
            
            // تبدیل محتوا به دیکشنری سوال-پاسخ
            const qaPairs = {};
            const lines = content.split('\n').filter(line => line.trim().length > 0);
            
            for (const line of lines) {
                const parts = line.split('=');
                if (parts.length === 2) {
                    const question = parts[0].trim();
                    const answer = parts[1].trim();
                    qaPairs[question] = answer;
                }
            }
            
            // ذخیره در کش
            knowledgeBaseCache = qaPairs;
            lastCacheUpdate = now;
            console.log(`📊 تعداد سوال-پاسخ: ${Object.keys(qaPairs).length}`);
            return qaPairs;
        } else {
            console.log('⚠️ فایل data.txt پیدا نشد');
            return {};
        }
    } catch (error) {
        console.log('❌ خطا در خواندن فایل دانش:', error.message);
        return knowledgeBaseCache || {}; // اگر خطا خورد، از کش قبلی استفاده کن
    }
}

// تابع برای پیدا کردن بهترین پاسخ
function findBestResponse(message, knowledgeBase) {
    const messageLower = message.toLowerCase().trim();
    
    console.log(`🔍 جستجو برای: "${message}"`);

    // اول دقیقاً مطابقت رو چک کن
    for (const [question, answer] of Object.entries(knowledgeBase)) {
        if (messageLower === question.toLowerCase()) {
            console.log(`✅ تطابق دقیق: "${question}"`);
            return answer;
        }
    }
    
    // سپس جستجوی جزئی
    for (const [question, answer] of Object.entries(knowledgeBase)) {
        const questionLower = question.toLowerCase();
        
        // اگر سوال کاربر شامل کلمات کلیدی سوال باشه
        const questionWords = questionLower.split(' ').filter(word => word.length > 2);
        let matchCount = 0;
        
        for (const word of questionWords) {
            if (messageLower.includes(word)) {
                matchCount++;
            }
        }
        
        // اگر حداقل 50% کلمات مطابقت داشته باشن
        if (matchCount > 0 && matchCount >= questionWords.length * 0.5) {
            console.log(`✅ تطابق جزئی (${matchCount}/${questionWords.length}): "${question}"`);
            return answer;
        }
    }
    
    // جستجوی کلمات کلیدی مهم
    const importantKeywords = ['قیمت', 'لورچ', 'پکیج', 'دیواری', 'پرداخت', 'شرایط', 'مدل', 'ظرفیت'];
    
    for (const keyword of importantKeywords) {
        if (messageLower.includes(keyword)) {
            for (const [question, answer] of Object.entries(knowledgeBase)) {
                if (question.toLowerCase().includes(keyword)) {
                    console.log(`✅ تطابق با کلمه کلیدی "${keyword}": "${question}"`);
                    return answer;
                }
            }
        }
    }
    
    // پاسخ پیش‌فرض
    return 'متأسفانه اطلاعات دقیقی درباره این سوال در سیستم من موجود نیست. لطفاً سوال خود را به صورت دقیق‌تر مطرح کنید.';
}

// تابع برای پشتیبان‌گیری خودکار
function autoBackup() {
    try {
        const dataPath = path.join(__dirname, 'data.txt');
        const backupDir = path.join(__dirname, 'backups');
        
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir);
        }
        
        if (fs.existsSync(dataPath)) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(backupDir, `data_backup_${timestamp}.txt`);
            const content = fs.readFileSync(dataPath, 'utf8');
            fs.writeFileSync(backupPath, content);
            console.log(`📦 پشتیبان خودکار ایجاد شد: ${backupPath}`);
        }
    } catch (error) {
        console.log('⚠️ خطا در ایجاد پشتیبان:', error.message);
    }
}

async function connectToWhatsApp() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('./baileys_auth');
        
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log('\n📱 لطفاً QR Code رو اسکن کنید:');
                qrcode.generate(qr, { small: true });
                console.log('⏳ منتظر اتصال...\n');
            }

            if (connection === 'close') {
                const shouldReconnect = lastDisconnect.error?.output?.statusCode !== 401;
                console.log('🔌 اتصال قطع شد...');
                if (shouldReconnect) {
                    console.log('🔄 راه‌اندازی مجدد در 5 ثانیه...');
                    setTimeout(connectToWhatsApp, 5000);
                }
            }
            
            if (connection === 'open') {
                console.log('🎉 ✅ ربات متصل شد و آماده است!');
                
                // ایجاد اولین پشتیبان پس از اتصال
                autoBackup();
                
                // بارگذاری دانش پایه
                const knowledgeBase = loadKnowledgeBase();
                
                // مقداردهی اولیه برای بررسی تغییرات
                const dataPath = path.join(__dirname, 'data.txt');
                if (fs.existsSync(dataPath)) {
                    const stats = fs.statSync(dataPath);
                    lastFileSize = stats.size;
                    lastFileModified = stats.mtimeMs;
                }
                
                console.log('🤖 ربات آماده پاسخگویی بر اساس فایل data.txt');
                
                // راه‌اندازی پشتیبان‌گیری دوره‌ای (هر 6 ساعت)
                setInterval(autoBackup, 6 * 60 * 60 * 1000);
                
                // راه‌اندازی بررسی تغییرات فایل (هر 24 ساعت)
                setInterval(checkFileChanges, FILE_CHECK_INTERVAL);
            }
        });

        sock.ev.on('messages.upsert', async (m) => {
            const msg = m.messages[0];
            
            if (!msg.key.fromMe && msg.message?.conversation) {
                const text = msg.message.conversation;
                const sender = msg.key.remoteJid;
                const messageId = `${sender}-${text}`;
                
                // چک کردن اینکه همین پیام اخیراً پردازش شده
                if (lastProcessedMessages.has(messageId)) {
                    const lastTime = lastProcessedMessages.get(messageId);
                    if (Date.now() - lastTime < MESSAGE_COOLDOWN) {
                        console.log('⏳ پیام تکراری - نادیده گرفته شد');
                        return;
                    }
                }
                
                lastProcessedMessages.set(messageId, Date.now());
                
                console.log(`\n📨 پیام جدید از کاربر: "${text}"`);
                
                // پردازش دستورات مدیریتی
                if (text.startsWith('/')) {
                    if (text === '/reload') {
                        console.log('🔄 درخواست بارگذاری مجدد دانش پایه...');
                        knowledgeBaseCache = null; // پاک کردن کش
                        const knowledgeBase = loadKnowledgeBase();
                        await sock.sendMessage(sender, { 
                            text: '✅ دانش پایه با موفقیت بروزرسانی شد!\nتعداد سوال-پاسخ: ' + Object.keys(knowledgeBase).length 
                        });
                        return;
                    }
                    
                    if (text === '/status') {
                        const knowledgeBase = loadKnowledgeBase();
                        await sock.sendMessage(sender, { 
                            text: `📊 وضعیت ربات:
• تعداد سوال-پاسخ: ${Object.keys(knowledgeBase).length}
• حافظه کش: ${knowledgeBaseCache ? 'فعال' : 'غیرفعال'}
• آخرین بروزرسانی: ${new Date(lastCacheUpdate).toLocaleTimeString('fa-IR')}
• بررسی تغییرات: فعال (هر 24 ساعت)`
                        });
                        return;
                    }
                    
                    if (text === '/backup') {
                        autoBackup();
                        await sock.sendMessage(sender, { 
                            text: '📦 پشتیبان خودکار ایجاد شد!' 
                        });
                        return;
                    }
                }
                
                // بارگذاری دانش پایه
                const knowledgeBase = loadKnowledgeBase();
                
                // پیدا کردن پاسخ مناسب
                const response = findBestResponse(text, knowledgeBase);
                
                console.log(`🤖 پاسخ ربات: "${response}"`);
                
                // ارسال پاسخ
                await sock.sendMessage(sender, { text: response });
                console.log('✅ پاسخ ارسال شد\n');
            }
        });

    } catch (error) {
        console.log('❌ خطا در اتصال:', error.message);
        setTimeout(connectToWhatsApp, 5000);
    }
}

// اجرای ربات
connectToWhatsApp();

// مدیریت خطاها
process.on('uncaughtException', (error) => {
    console.log('⚠️ خطای غیرمنتظره:', error.message);
});

process.on('unhandledRejection', (reason, promise) => {
    console.log('⚠️ Promise رد شده:', reason);
});

// پاکسازی حافظه هر 10 دقیقه
setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of lastProcessedMessages.entries()) {
        if (now - timestamp > 600000) { // 10 دقیقه
            lastProcessedMessages.delete(key);
        }
    }
}, 600000);

console.log('✨ ربات با قابلیت‌های پیشرفته راه‌اندازی شد!');