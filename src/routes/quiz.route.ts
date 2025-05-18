import express from 'express';
import {
    getQuizbyId,
    createQuiz,
    getAllQuizzes,
    updateQuiz,
    deleteQuiz,
    getQuizzesByCourse,
    getQuizzesBySection,
    submitQuiz,
    createQuestion,
    deleteQuestion,
    getAllQuestions,
    getQuestionById,
    updateQuestionInQuiz
} from '../controllers/quiz.controller';
import { isAuthenticated } from '../middlewares/auth/isAuthenticated';
import { updateAccessToken } from '../controllers/user.controller';

/**
 * @swagger
 * tags:
 *   name: Quizzes
 *   description: Quiz management endpoints
 */

const router = express.Router();

/**
 * @swagger
 * /api/quizzes:
 *   post:
 *     summary: Create a new quiz
 *     tags: [Quizzes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - courseId
 *               - title
 *               - questions
 *             properties:
 *               courseId:
 *                 type: string
 *               title:
 *                 type: string
 *               questions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - question
 *                     - options
 *                     - correctAnswer
 *                   properties:
 *                     question:
 *                       type: string
 *                     options:
 *                       type: array
 *                       items:
 *                         type: string
 *                     correctAnswer:
 *                       type: string
 *     responses:
 *       201:
 *         description: Quiz created successfully
 *       401:
 *         description: Not authenticated
 */
router.post('/', updateAccessToken, isAuthenticated, createQuiz);

/**
 * @swagger
 * /api/quizzes/{id}:
 *   get:
 *     summary: Get quiz by ID
 *     tags: [Quizzes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Quiz details
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Quiz not found
 */
router.get('/:id', updateAccessToken, isAuthenticated, getQuizbyId);

// GET /api/quizzes - Fetch all quizzes (without pagination)
router.get('/', getAllQuizzes);

// GET /api/quizzes/course/:courseId - Fetch quizzes by course
router.get('/course/:courseId', getQuizzesByCourse);

// PUT /api/quizzes/:quizId - Update a quiz
router.put('/:id', updateQuiz);

// DELETE /api/quizzes/:quizId - Delete a quiz
router.delete('/:id', deleteQuiz);

// GET /api/quizzes/section/:videoSection - Fetch quizzes by videoSection
router.get('/section/:videoSection', getQuizzesBySection);

/**
 * @swagger
 * /api/quizzes/{id}/submit:
 *   post:
 *     summary: Submit quiz answers
 *     tags: [Quizzes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - answers
 *             properties:
 *               answers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - questionId
 *                     - selectedAnswer
 *                   properties:
 *                     questionId:
 *                       type: string
 *                     selectedAnswer:
 *                       type: string
 *     responses:
 *       200:
 *         description: Quiz submitted successfully
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Quiz not found
 */
router.post('/:id/submit', updateAccessToken, isAuthenticated, submitQuiz);

router.get('/:id/questions/:questionId', getQuestionById);

router.get('/:id/questions', getAllQuestions);

router.post('/:id/questions', createQuestion);

router.put('/:id/questions/:questionId', updateQuestionInQuiz);

router.delete('/:id/questions/:questionId', deleteQuestion);

export = router;
