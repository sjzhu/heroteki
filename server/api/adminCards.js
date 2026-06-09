/**
 * SotMDE API — Admin card image upload endpoint.
 * Phase 6, Step 6.4.
 *
 * POST /api/admin/cards/upload-image
 *   - Admin role required
 *   - Accepts JPEG/PNG/WebP only, max 3 MB
 *   - Generates UUID filename, writes to public/card-images/manual/
 *   - Updates card document's imageUrl in MongoDB
 *   - Returns { imageUrl }
 */

'use strict';

const passport = require('passport');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const monk = require('monk');
const { wrapAsync } = require('../util.js');
const logger = require('../log.js');

const MANUAL_DIR = path.join(__dirname, '../../public/card-images/manual');

// Ensure the output directory exists
if (!fs.existsSync(MANUAL_DIR)) {
    fs.mkdirSync(MANUAL_DIR, { recursive: true });
}

const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp'];
const EXTENSION_MAP = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp'
};

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, MANUAL_DIR);
    },
    filename: function (req, file, cb) {
        const ext = EXTENSION_MAP[file.mimetype] || path.extname(file.originalname);
        cb(null, uuidv4() + ext);
    }
});

function fileFilter(req, file, cb) {
    if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: JPEG, PNG, WebP`), false);
    }
}

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 3 * 1024 * 1024 } // 3 MB
});

function requireAdmin(req, res, next) {
    if (!req.user || !req.user.permissions?.isAdmin) {
        return res.status(403).send({ success: false, message: 'Admin role required' });
    }
    next();
}

function getDb() {
    const mongoUrl = process.env.MONGO_URL || require('config').get('mongo');
    return monk(mongoUrl);
}

module.exports.init = function (server) {
    server.post(
        '/api/admin/cards/upload-image',
        passport.authenticate('jwt', { session: false }),
        requireAdmin,
        function (req, res, next) {
            upload.single('image')(req, res, function (err) {
                if (err) {
                    if (err.code === 'LIMIT_FILE_SIZE') {
                        return res.status(400).send({
                            success: false,
                            message: 'File too large. Maximum size is 3 MB.'
                        });
                    }
                    return res.status(400).send({ success: false, message: err.message });
                }
                next();
            });
        },
        wrapAsync(async function (req, res) {
            if (!req.file) {
                return res.status(400).send({ success: false, message: 'No image file provided' });
            }

            const cardId = req.body.cardId;
            if (!cardId) {
                // Clean up the uploaded file
                fs.unlink(req.file.path, () => {});
                return res.status(400).send({ success: false, message: 'cardId is required' });
            }

            const imageUrl = `/card-images/manual/${req.file.filename}`;

            const db = getDb();
            const cardsCollection = db.get('sotmCards');

            const card = await cardsCollection.findOne({ id: cardId });
            if (!card) {
                await db.close();
                // Clean up the uploaded file
                fs.unlink(req.file.path, () => {});
                return res
                    .status(404)
                    .send({ success: false, message: `Card not found: ${cardId}` });
            }

            await cardsCollection.findOneAndUpdate({ id: cardId }, { $set: { imageUrl } });

            await db.close();

            logger.info(
                `Admin ${req.user.username} uploaded image for card ${cardId}: ${imageUrl}`
            );

            return res.send({ success: true, imageUrl });
        })
    );
};
