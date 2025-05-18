import express from 'express';
import { isAuthenticated } from '../middlewares/auth/isAuthenticated';
import { createLayout, editLayout, getLayoutByType } from '../controllers/layout.controller';
import { authorizeRoles } from '../middlewares/auth/authorizeRoles';

/**
 * @swagger
 * tags:
 *   name: Layout
 *   description: Layout management endpoints
 */

const router = express.Router();

/**
 * @swagger
 * /api/layout:
 *   post:
 *     summary: Create layout (Admin only)
 *     tags: [Layout]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - title
 *               - subTitle
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [banner, faq, categories]
 *               title:
 *                 type: string
 *               subTitle:
 *                 type: string
 *     responses:
 *       201:
 *         description: Layout created successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 */
router.post('/', isAuthenticated, authorizeRoles('admin'), createLayout);

router.put('/', isAuthenticated, authorizeRoles('admin'), editLayout);

/**
 * @swagger
 * /api/layout:
 *   get:
 *     summary: Get layout
 *     tags: [Layout]
 *     responses:
 *       200:
 *         description: Layout details
 */
router.get('/', getLayoutByType);

export = router;
