const express = require('express');
const router = express.Router();

const { getLegacyClaims, approveLegacyClaim } = require('../controllers/authController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// GET /api/admin/legacy-claims
router.get('/legacy-claims', protect, adminOnly, getLegacyClaims);

// PUT /api/admin/legacy-claims/:id/approve
router.put('/legacy-claims/:id/approve', protect, adminOnly, approveLegacyClaim);

module.exports = router;