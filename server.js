const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const app = express();

/* =========================
MIDDLEWARE
========================= */

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static('public'));

app.set('view engine', 'ejs');

app.use(session({
    secret: 'organisation-secret',
    resave: false,
    saveUninitialized: true
}));

/* =========================
DATABASE
========================= */

const db = new sqlite3.Database('./database.db');

/* =========================
CREATE TABLES
========================= */

db.serialize(() => {

    db.run(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT
    )
    `);

    db.run(`
    CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT,
        originalname TEXT,
        username TEXT,
        uploadDate TEXT
    )
    `);

    db.run(`
    CREATE TABLE IF NOT EXISTS announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message TEXT,
        createdBy TEXT,
        createdAt TEXT
    )
    `);

});

/* =========================
DEFAULT USERS
========================= */

const defaultUsers = [
    {
        username: 'admin',
        password: 'admin123',
        role: 'admin'
    },
    {
        username: 'user1',
        password: 'user123',
        role: 'user'
    },
    {
        username: 'manager',
        password: 'manager123',
        role: 'user'
    },
    {
        username: 'staff',
        password: 'staff123',
        role: 'user'
    }
];

defaultUsers.forEach(u => {

    db.get(
        'SELECT * FROM users WHERE username = ?',
        [u.username],
        (err, row) => {

            if (!row) {

                db.run(
                    `
                    INSERT INTO users
                    (username, password, role)
                    VALUES (?, ?, ?)
                    `,
                    [u.username, u.password, u.role]
                );

                console.log(`Created user: ${u.username}`);
            }
        }
    );
});

/* =========================
MULTER STORAGE
========================= */

const storage = multer.diskStorage({

    destination: (req, file, cb) => {

        const uploadPath = './uploads';

        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath);
        }

        cb(null, uploadPath);
    },

    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }

});

/* =========================
UPLOAD SETTINGS
========================= */

const upload = multer({

    storage: storage,

    limits: {
        fileSize: 1024 * 1024 * 1024
    }

});

/* =========================
LOGIN REQUIRED
========================= */

function requireLogin(req, res, next) {

    if (!req.session.user) {
        return res.redirect('/');
    }

    next();
}

/* =========================
GET REAL D DRIVE STORAGE
========================= */

function getDiskStorage() {

    try {

        const output = execSync(
            `wmic logicaldisk where "DeviceID='D:'" get Size,FreeSpace /format:value`
        ).toString();

        const sizeMatch = output.match(/Size=(\d+)/);
        const freeMatch = output.match(/FreeSpace=(\d+)/);

        const totalBytes = parseInt(sizeMatch[1]);
        const freeBytes = parseInt(freeMatch[1]);

        const usedBytes = totalBytes - freeBytes;

        const totalGB =
        (totalBytes / 1024 / 1024 / 1024).toFixed(2);

        const usedGB =
        (usedBytes / 1024 / 1024 / 1024).toFixed(2);

        const percentUsed =
        ((usedBytes / totalBytes) * 100).toFixed(2);

        return {
            totalGB,
            usedGB,
            percentUsed
        };

    } catch (err) {

        return {
            totalGB: 0,
            usedGB: 0,
            percentUsed: 0
        };

    }

}

/* =========================
LOGIN PAGE
========================= */

app.get('/', (req, res) => {
    res.render('login');
});

/* =========================
LOGIN
========================= */

app.post('/login', (req, res) => {

    const { username, password } = req.body;

    db.get(
        `
        SELECT * FROM users
        WHERE username = ?
        AND password = ?
        `,
        [username, password],
        (err, user) => {

            if (user) {

                req.session.user = user;
                res.redirect('/dashboard');

            } else {

                res.send('Invalid username or password');
            }
        }
    );
});

/* =========================
DASHBOARD
========================= */

app.get('/dashboard', requireLogin, (req, res) => {

    const user = req.session.user;

    const search = req.query.search || '';
    const date = req.query.date || '';
    const sort = req.query.sort || 'latest';

    const storage = getDiskStorage();

    let query = `
    SELECT * FROM documents
    WHERE originalname LIKE ?
    `;

    let params = [`%${search}%`];

    if (date) {

        query += `
        AND DATE(uploadDate) = DATE(?)
        `;

        params.push(date);
    }

    if (sort === 'oldest') {

        query += `
        ORDER BY uploadDate ASC
        `;

    } else {

        query += `
        ORDER BY uploadDate DESC
        `;
    }

    db.all(query, params, (err, documents) => {

        db.all(
            `
            SELECT * FROM announcements
            ORDER BY id DESC
            `,
            [],
            (err, announcements) => {

                const recentDocuments = documents.slice(0, 5);

                res.render('dashboard', {
                    user,
                    documents,
                    announcements,
                    storage,
                    recentDocuments
                });
            }
        );
    });
});

/* =========================
UPLOAD DOCUMENTS
ADMIN ONLY
========================= */

app.post(
    '/upload',
    requireLogin,
    upload.array('documents', 1000),
    (req, res) => {

        const user = req.session.user;

        if (user.role !== 'admin') {
            return res.send('Only admin can upload');
        }

        const files = req.files;

        if (!files || files.length === 0) {
            return res.send('No files uploaded');
        }

        files.forEach(file => {

            db.run(
                `
                INSERT INTO documents
                (filename, originalname, username, uploadDate)
                VALUES (?, ?, ?, ?)
                `,
                [
                    file.filename,
                    file.originalname,
                    user.username,
                    new Date().toISOString()
                ]
            );
        });

        res.redirect('/dashboard');
    }
);

/* =========================
DOWNLOAD
========================= */

app.get(
    '/download/:filename',
    requireLogin,
    (req, res) => {

        const filePath = path.join(
            __dirname,
            'uploads',
            req.params.filename
        );

        res.download(filePath);
    }
);

/* =========================
ANNOUNCEMENTS
ADMIN ONLY
========================= */

app.post(
    '/announcement',
    requireLogin,
    (req, res) => {

        const user = req.session.user;

        if (user.role !== 'admin') {
            return res.send('Only admin allowed');
        }

        const message = req.body.message;

        db.run(
            `
            INSERT INTO announcements
            (message, createdBy, createdAt)
            VALUES (?, ?, ?)
            `,
            [
                message,
                user.username,
                new Date().toLocaleString()
            ]
        );

        res.redirect('/dashboard');
    }
);

/* =========================
LOGOUT
========================= */

app.get('/logout', (req, res) => {

    req.session.destroy(() => {
        res.redirect('/');
    });
});

/* =========================
START SERVER
========================= */

const PORT = 3000;

app.listen(PORT, '0.0.0.0', () => {

    console.log(`
Server running at:
http://localhost:${PORT}
`);

    console.log(`
LOGIN DETAILS:

ADMIN:
username: admin
password: admin123

USER:
username: user1
password: user123

MANAGER:
username: manager
password: manager123

STAFF:
username: staff
password: staff123
`);
});

