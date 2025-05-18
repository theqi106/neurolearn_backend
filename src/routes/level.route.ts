import express from 'express';
import { isAuthenticated } from '../middlewares/auth/isAuthenticated';
import { authorizeRoles } from '../middlewares/auth/authorizeRoles';
import { createLevel, getLevels } from '../controllers/level.controller';

/**
 * @swagger
 * tags:
 *   name: Levels
 *   description: Course level management endpoints
 */

const router = express.Router();

/**
 * @swagger
 * /api/levels:
 *   post:
 *     summary: Create a new level (Admin only)
 *     tags: [Levels]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Level created successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized
 */
router.post('/', isAuthenticated, authorizeRoles('admin'), createLevel);

/**
 * @swagger
 * /api/levels:
 *   get:
 *     summary: Get all levels
 *     tags: [Levels]
 *     responses:
 *       200:
 *         description: List of all levels
 */
router.get('/', getLevels);

export = router;
