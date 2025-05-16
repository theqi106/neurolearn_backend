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

const router = express.Router();

// GET /api/quizzes - Fetch all quizzes (without pagination)
router.get('/', getAllQuizzes);

// GET /api/quizzes/:quizId - Fetch a quiz by ID
router.get('/:id', getQuizbyId);

// GET /api/quizzes/course/:courseId - Fetch quizzes by course
router.get('/course/:courseId', getQuizzesByCourse);

// POST /api/quizzes - Create a new quiz
router.post('/create-quiz', createQuiz);

// PUT /api/quizzes/:quizId - Update a quiz
router.put('/:id', updateQuiz);

// DELETE /api/quizzes/:quizId - Delete a quiz
router.delete('/:id', deleteQuiz);

// GET /api/quizzes/section/:videoSection - Fetch quizzes by videoSection
router.get('/section/:videoSection', getQuizzesBySection);

// POST /api/quizzes/:quizId/submit - Submit quiz answers
router.post('/:quizId/submit', submitQuiz);

router.get('/:id/questions/:questionId', getQuestionById);

router.get('/:id/questions', getAllQuestions);

router.post('/:id/questions', createQuestion);

router.put('/:id/questions/:questionId', updateQuestionInQuiz);

router.delete('/:id/questions/:questionId', deleteQuestion);

export = router;
