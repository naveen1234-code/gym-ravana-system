const express = require('express');
const router = express.Router();

const { getLegacyClaims, approveLegacyClaim } = require('../controllers/authController');

// GET /api/admin/legacy-claims
router.get('/legacy-claims', getLegacyClaims);

// PUT /api/admin/legacy-claims/:id/approve
router.put('/legacy-claims/:id/approve', approveLegacyClaim);

module.exports = router;