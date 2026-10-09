const express = require('express');
const { DatabaseSync } = require('node:sqlite');
const { nanoid } = require('nanoid');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// قاعدة بيانات SQLite المدمجة في Node.js
const db = new DatabaseSync('./database.sqlite');
db.exec(`CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    original_url TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    used_at DATETIME
)`);

console.log('Database initialized successfully.');

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/create-link', (req, res) => {
    const { original_url, amount } = req.body;

    if (!original_url || amount === undefined || amount === null) {
        return res.status(400).json({ success: false, error: 'يرجى إرسال الرابط والمبلغ.' });
    }

    const cleanAmount = parseFloat(amount);
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
        return res.status(400).json({ success: false, error: 'المبلغ غير صحيح.' });
    }

    const shortId = nanoid(8);
    try {
        const stmt = db.prepare('INSERT INTO payments (id, original_url, amount) VALUES (?, ?, ?)');
        stmt.run(shortId, original_url.trim(), cleanAmount);

        const host = req.get('host');
        const protocol = req.protocol;
        const fullPaymentUrl = `${protocol}://${host}/pay/${shortId}`;

        res.json({
            success: true,
            id: shortId,
            payment_url: fullPaymentUrl,
            amount: cleanAmount
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/history', (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM payments ORDER BY datetime(created_at) DESC');
        const rows = stmt.all();
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.delete('/api/delete/:id', (req, res) => {
    const { id } = req.params;
    try {
        const stmt = db.prepare('DELETE FROM payments WHERE id = ?');
        stmt.run(id);
        res.json({ success: true, message: 'تم الحذف بنجاح' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/pay/:id', (req, res) => {
    const { id } = req.params;

    try {
        const stmt = db.prepare('SELECT * FROM payments WHERE id = ?');
        const row = stmt.get(id);

        if (!row) {
            return res.status(404).send(`
                <!DOCTYPE html>
                <html dir="rtl" lang="ar">
                <head><meta charset="UTF-8"><title>الرابط غير موجود</title></head>
                <body style="font-family:sans-serif; text-align:center; padding:50px;">
                    <h2>عذراً، رابط الفاتورة غير صحيح أو تم حذفه.</h2>
                </body>
                </html>
            `);
        }

        const isUsed = row.status === 'used';
        const formattedAmount = Number(row.amount).toFixed(3);

        res.send(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>بوابة الدفع - شركة دبوس لطباعة وتصوير المستندات</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                    background: #f8fafc;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    padding: 16px;
                }
                .invoice-card {
                    background: #ffffff;
                    width: 100%;
                    max-width: 440px;
                    border-radius: 24px;
                    padding: 34px 24px;
                    box-shadow: 0 15px 35px -5px rgba(0, 0, 0, 0.08);
                    text-align: center;
                    border: 1px solid #e2e8f0;
                    position: relative;
                    overflow: hidden;
                    z-index: 1;
                }
                .invoice-card::before {
                    content: "";
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background-image: url('/logo.png');
                    background-repeat: repeat;
                    background-size: 130px 130px;
                    opacity: 0.045;
                    pointer-events: none;
                    z-index: -1;
                }
                .logo-container {
                    width: 100px;
                    height: 100px;
                    margin: 0 auto 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .logo-container img {
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: contain;
                }
                .company-name {
                    font-size: 1.25rem;
                    font-weight: 800;
                    color: #0f172a;
                    margin-bottom: 6px;
                }
                .company-address {
                    color: #475569;
                    font-size: 0.88rem;
                    line-height: 1.5;
                    margin-bottom: 6px;
                }
                .company-phones {
                    color: #1e293b;
                    font-weight: 700;
                    direction: ltr;
                    font-size: 0.95rem;
                    margin-bottom: 18px;
                }
                .divider {
                    height: 1px;
                    background: #e2e8f0;
                    margin: 18px 0;
                }
                .customer-greeting {
                    font-size: 1.05rem;
                    font-weight: 700;
                    color: #1e3a8a;
                    margin-bottom: 15px;
                }
                .price-box {
                    background: rgba(248, 250, 252, 0.9);
                    border: 1.5px solid #cbd5e1;
                    border-radius: 16px;
                    padding: 20px;
                    margin-bottom: 22px;
                    backdrop-filter: blur(2px);
                }
                .price-label {
                    color: #64748b;
                    font-size: 0.9rem;
                    margin-bottom: 6px;
                }
                .price-amount {
                    font-size: 2.2rem;
                    font-weight: 800;
                    color: #047857;
                }
                .currency {
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: #475569;
                    margin-right: 4px;
                }
                .btn-pay {
                    display: inline-block;
                    width: 100%;
                    padding: 15px;
                    background: #10b981;
                    color: #ffffff;
                    border: none;
                    border-radius: 12px;
                    font-size: 1.15rem;
                    font-weight: 700;
                    cursor: pointer;
                    text-decoration: none;
                    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);
                }
                .btn-pay:hover {
                    background: #059669;
                }
                .btn-disabled {
                    background: #94a3b8 !important;
                    cursor: not-allowed;
                    box-shadow: none;
                }
                .alert-used {
                    background: #fef2f2;
                    border: 1px solid #fecaca;
                    color: #b91c1c;
                    padding: 12px;
                    border-radius: 10px;
                    font-size: 0.9rem;
                    margin-top: 15px;
                    line-height: 1.4;
                }
                .footer-note {
                    color: #94a3b8;
                    font-size: 0.8rem;
                    margin-top: 14px;
                }
            </style>
        </head>
        <body>
            <div class="invoice-card">
                <div class="logo-container">
                    <img src="/logo.png" alt="شعار شركة دبوس" onerror="this.style.display='none'">
                </div>
                <div class="company-name">شركة دبوس لطباعة وتصوير المستندات</div>
                <div class="company-address">العقيلة - ق ٥ - مركز ضاري - الميزانين - محل رقم ٥</div>
                <div class="company-phones">56619683 - 66612278</div>

                <div class="divider"></div>

                <div class="customer-greeting">عميل شركة دبوس لطباعة وتصوير المستندات العزيز</div>
                
                <div class="price-box">
                    <div class="price-label">برجاء دفع مبلغ قيمته:</div>
                    <div class="price-amount">${formattedAmount} <span class="currency">د.ك</span></div>
                </div>

                ${isUsed ? `
                    <button class="btn-pay btn-disabled" disabled>تم استخدام هذا الرابط مسبقاً</button>
                    <div class="alert-used">
                        عذراً، هذا الرابط مخصص للاستخدام لمرة واحدة فقط وقد تم الانتقال للدفع مسبقاً.
                    </div>
                ` : `
                    <form action="/pay/${id}/proceed" method="POST">
                        <button type="submit" class="btn-pay">الانتقال للدفع الآن</button>
                    </form>
                    <div class="footer-note">سيتم تحويلك مباشرة إلى بوابة الدفع البنكية الرسمية</div>
                `}
            </div>
        </body>
        </html>
        `);
    } catch (err) {
        res.status(500).send('خطأ في الخادم');
    }
});

app.post('/pay/:id/proceed', (req, res) => {
    const { id } = req.params;

    try {
        const stmt = db.prepare('SELECT * FROM payments WHERE id = ?');
        const row = stmt.get(id);

        if (!row) return res.status(404).send('الرابط غير صالح');

        if (row.status === 'used') {
            return res.redirect(`/pay/${id}`);
        }

        const updateStmt = db.prepare("UPDATE payments SET status = 'used', used_at = CURRENT_TIMESTAMP WHERE id = ?");
        updateStmt.run(id);

        res.redirect(row.original_url);
    } catch (err) {
        res.status(500).send('خطأ أثناء معالجة الطلب');
    }
});

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
