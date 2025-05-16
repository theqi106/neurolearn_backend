import { catchAsync } from '../utils/catchAsync';
import { NextFunction, Request, Response } from 'express';
import { redis } from '../utils/redis';
import Quiz from '../models/Quiz.model'; // Adjust the import path as needed
import Course from '../models/Course.model'; // Import Course model
import ErrorHandler from '../utils/ErrorHandler';
import mongoose from 'mongoose';

// GET /api/quizzes/:quizId - Fetch a quiz by ID
export const getQuizbyId = catchAsync(async (req, res, next) => {
    const quizId = req.params.id;

    if (!quizId) {
        return next(new ErrorHandler('Please provide a quiz id', 400));
    }

    const quiz = await Quiz.aggregate([
        {
            $match: { _id: new mongoose.Types.ObjectId(quizId) }
        },
        {
            $unwind: {
                path: '$userScores',
                preserveNullAndEmptyArrays: true // Keep quizzes without scores
            }
        },
        {
            $lookup: {
                from: 'users', // The collection to join
                localField: 'userScores.user', // Field in the quiz document
                foreignField: '_id', // Field in the users collection
                as: 'userScores.userDetails' // Output array field
            }
        },
        {
            $unwind: {
                path: '$userScores.userDetails',
                preserveNullAndEmptyArrays: true // Keep scores without user details
            }
        },
        {
            $group: {
                _id: '$_id',
                root: { $first: '$$ROOT' }, // Preserve the original quiz document
                userScores: { $push: '$userScores' } // Rebuild the userScores array
            }
        },
        {
            $replaceRoot: {
                newRoot: {
                    $mergeObjects: [
                        '$root',
                        { userScores: '$userScores' } // Replace userScores with the rebuilt array
                    ]
                }
            }
        },
        {
            $project: {
                title: 1,
                description: 1,
                difficulty: 1,
                duration: 1,
                passingScore: 1,
                maxAttempts: 1,
                isPublished: 1,
                order: 1,
                videoSection: 1,
                courseId: 1,
                questions: 1,
                userScores: {
                    $map: {
                        input: '$userScores',
                        as: 'score',
                        in: {
                            user: {
                                $ifNull: [
                                    '$$score.userDetails',
                                    {
                                        name: 'Unknown User',
                                        email: 'unknown@example.com',
                                        avatar: { url: '/default-avatar.png' }
                                    }
                                ]
                            },
                            score: '$$score.score',
                            attemptedAt: '$$score.attemptedAt'
                        }
                    }
                }
            }
        }
    ]);

    if (!quiz || quiz.length === 0) {
        return next(new ErrorHandler('Quiz not found', 404));
    }

    res.status(200).json({
        success: true,
        quiz: quiz[0] // Return the first (and only) quiz document
    });
});

export const createQuiz = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const {
        title,
        description,
        difficulty,
        duration,
        passingScore,
        maxAttempts,
        isPublished,
        questions,
        videoSection,
        courseId,
        instructorId
    } = req.body;

    // Validate required fields
    if (
        !title ||
        !difficulty ||
        !duration ||
        !passingScore ||
        !maxAttempts ||
        !videoSection ||
        !courseId ||
        !instructorId
    ) {
        return next(new ErrorHandler('Missing required fields', 400));
    }

    // Check if the course exists
    const course = await Course.findById(courseId);
    if (!course) {
        return next(new ErrorHandler('Course not found', 404));
    }

    // Check if a quiz already exists for this videoSection in the course
    const existingQuiz = await Quiz.findOne({ videoSection, courseId });
    if (existingQuiz) {
        return next(new ErrorHandler('A quiz already exists for this section', 400));
    }

    // Find the relevant section in the course
    const section = course.courseData.find((data: any) => data.videoSection === videoSection);
    if (!section) {
        return next(new ErrorHandler('Section not found in course', 404));
    }

    // Get all lessons in the section to determine the highest lessonOrder
    const lessonsInSection = course.courseData.filter(
        (data: any) => data.videoSection === videoSection && data.lessonOrder !== undefined
    );

    // Find the highest lessonOrder in the section
    const maxLessonOrder = lessonsInSection.reduce(
        (max: number, lesson: any) => Math.max(max, lesson.lessonOrder || 0),
        0
    );

    // Create a new quiz with lessonOrder set to the final position
    const newQuiz = new Quiz({
        title,
        description,
        difficulty,
        duration,
        passingScore,
        maxAttempts,
        isPublished,
        instructorId,
        questions,
        videoSection,
        courseId,
        lessonOrder: maxLessonOrder + 1 // Set lessonOrder to the final position
    });

    // Save the quiz to the database
    const savedQuiz = await newQuiz.save();

    // Add quiz to the section
    section.quizzes.push(savedQuiz._id);

    // Save the updated course
    await course.save();

    res.status(201).json({
        success: true,
        data: savedQuiz
    });
});

// GET /api/quizzes - Fetch all quizzes (without pagination)
export const getAllQuizzes = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { difficulty, courseId } = req.query;

    // Build the query
    const query: any = {};
    if (difficulty) query.difficulty = difficulty;
    if (courseId) query.courseId = courseId;

    // Fetch all quizzes
    const quizzes = await Quiz.find(query).populate('instructorId', 'name email').populate('courseId', 'tags');

    // Cache the result in Redis
    const cacheKey = `quizzes:${JSON.stringify(req.query)}`;
    await redis.set(cacheKey, JSON.stringify(quizzes), 'EX', 3600); // Cache for 1 hour

    // Return the quizzes
    res.status(200).json({
        success: true,
        quizzes
    });
});

// PUT /api/quizzes/:quizId - Update a quiz
export const updateQuiz = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const quizId = req.params.id;
    const updateData = req.body;

    // Validate quizId format
    if (!mongoose.Types.ObjectId.isValid(quizId)) {
        return next(new ErrorHandler('Invalid quiz ID format', 400));
    }

    // Find and update the quiz
    const updatedQuiz = await Quiz.findByIdAndUpdate(quizId, updateData, {
        new: true, // Return the updated document
        runValidators: true // Run Mongoose validators
    });

    // If quiz not found, return an error
    if (!updatedQuiz) {
        return next(new ErrorHandler('Quiz not found', 404));
    }

    // Invalidate Redis cache for this quiz
    await redis.del(quizId);

    // Return the updated quiz
    res.status(200).json({
        success: true,
        message: 'Quiz updated successfully',
        quiz: updatedQuiz
    });
});

// DELETE /api/quizzes/:quizId - Delete a quiz
export const deleteQuiz = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const quizId = req.params.id;

    // Validate quizId format
    if (!mongoose.Types.ObjectId.isValid(quizId)) {
        return next(new ErrorHandler('Invalid quiz ID format', 400));
    }

    // Find the quiz
    const quiz = await Quiz.findById(quizId);
    // Remove the quiz from the course's section
    const course = await Course.findById(quiz.courseId);
    if (course) {
        const courseData = course.courseData.find((data: any) => data.videoSection === quiz.videoSection);
        if (courseData) {
            courseData.quizzes = courseData.quizzes.filter((q: any) => q.toString() !== quizId);
            await course.save();
        }
    }

    // Delete the quiz
    await Quiz.findByIdAndDelete(quizId);

    // Invalidate Redis cache for this quiz
    await redis.del(quizId);

    // Return success message
    res.status(200).json({
        success: true,
        message: 'Quiz deleted successfully'
    });
});

// GET /api/quizzes/course/:courseId - Fetch quizzes by course
export const getQuizzesByCourse = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.courseId;

    // Validate courseId format
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
        return next(new ErrorHandler('Invalid course ID format', 400));
    }

    // Fetch quizzes by courseId
    const quizzes = await Quiz.find({ courseId }).populate('instructorId', 'name email').populate('courseId', 'title');

    // Return the quizzes
    res.status(200).json({
        success: true,
        quizzes
    });
});

export const getQuizzesBySection = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const videoSection = req.params.videoSection;

    // Validate videoSection
    if (!videoSection) {
        return next(new ErrorHandler('Please provide a video section', 400));
    }

    // Fetch quizzes by videoSection
    const quizzes = await Quiz.find({ videoSection })
        .populate('instructorId', 'name email')
        .populate('courseId', 'title');

    // Return the quizzes
    res.status(200).json({
        success: true,
        quizzes
    });
});

// POST /api/quizzes/:quizId/submit - Submit quiz answers
export const submitQuiz = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const quizId = req.params.id;
    const { userId, answers } = req.body;

    // Validate quizId format
    if (!mongoose.Types.ObjectId.isValid(quizId)) {
        return next(new ErrorHandler('Invalid quiz ID format', 400));
    }

    // Find the quiz
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
        return next(new ErrorHandler('Quiz not found', 404));
    }

    // Calculate the score
    let score = 0;
    quiz.questions.forEach((question: any, index: any) => {
        if (question.correctAnswer === answers[index]) {
            score += question.points;
        }
    });

    // Save the user's score
    quiz.userScores.push({
        user: userId,
        score,
        attemptedAt: new Date()
    });

    // Save the updated quiz
    await quiz.save();

    // Return the result
    res.status(200).json({
        success: true,
        message: 'Quiz submitted successfully',
        score,
        passingScore: quiz.passingScore,
        isPassed: score >= quiz.passingScore
    });
});
export const updateQuestionInQuiz = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id, questionId } = req.params;
    const updateData = req.body; // Dữ liệu cập nhật từ client

    // Kiểm tra xem quizId và questionId có được cung cấp không
    if (!id || !questionId) {
        return next(new ErrorHandler('Please provide quiz ID and question ID', 400));
    }

    // Tìm quiz trong database
    const quiz = await Quiz.findById(id);
    if (!quiz) {
        return next(new ErrorHandler('Quiz not found', 404));
    }

    // Tìm câu hỏi cần cập nhật trong quiz
    const questionToUpdate = quiz.questions.id(questionId);
    if (!questionToUpdate) {
        return next(new ErrorHandler('Question not found in the quiz', 404));
    }

    // Cập nhật thông tin của câu hỏi
    if (updateData.text) questionToUpdate.text = updateData.text;
    if (updateData.type) questionToUpdate.type = updateData.type;
    if (updateData.points) questionToUpdate.points = updateData.points;
    if (updateData.options) questionToUpdate.options = updateData.options;
    if (updateData.correctAnswer) questionToUpdate.correctAnswer = updateData.correctAnswer;

    // Validate lại câu hỏi sau khi cập nhật
    const validationError = questionToUpdate.validateSync();
    if (validationError) {
        return next(new ErrorHandler(validationError.message, 400));
    }

    // Lưu thay đổi vào database
    await quiz.save();

    // Cập nhật lại cache trong Redis (nếu cần)
    await redis.set(id, JSON.stringify(quiz), 'EX', 604800); // Cache for 7 days

    // Trả về kết quả
    res.status(200).json({
        success: true,
        message: 'Question updated successfully',
        quiz
    });
});

// GET /api/quizzes/:quizId/questions/:questionId - Get a specific question in a quiz
export const getQuestionById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id, questionId } = req.params;

    // Kiểm tra quizId và questionId
    if (!id || !questionId) {
        return next(new ErrorHandler('Please provide quiz ID and question ID', 400));
    }

    // Tìm quiz trong database
    const quiz = await Quiz.findById(id);
    if (!quiz) {
        return next(new ErrorHandler('Quiz not found', 404));
    }

    // Tìm câu hỏi trong quiz
    const question = quiz.questions.id(questionId);
    if (!question) {
        return next(new ErrorHandler('Question not found in the quiz', 404));
    }

    // Trả về câu hỏi
    res.status(200).json({
        success: true,
        question
    });
});

// GET /api/quizzes/:quizId/questions - Get all questions in a quiz
export const getAllQuestions = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    // Kiểm tra quizId
    if (!id) {
        return next(new ErrorHandler('Please provide a quiz ID', 400));
    }

    // Tìm quiz trong database
    const quiz = await Quiz.findById(id);
    if (!quiz) {
        return next(new ErrorHandler('Quiz not found', 404));
    }

    // Trả về tất cả câu hỏi trong quiz
    res.status(200).json({
        success: true,
        questions: quiz.questions
    });
});

// DELETE /api/quizzes/:quizId/questions/:questionId - Delete a specific question in a quiz
export const deleteQuestion = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id, questionId } = req.params;

    // Kiểm tra id và questionId
    if (!id || !questionId) {
        return next(new ErrorHandler('Please provide quiz ID and question ID', 400));
    }

    // Tìm quiz trong database
    const quiz = await Quiz.findById(id);
    if (!quiz) {
        return next(new ErrorHandler('Quiz not found', 404));
    }

    // Tìm câu hỏi trong quiz
    const question = quiz.questions.id(questionId);
    if (!question) {
        return next(new ErrorHandler('Question not found in the quiz', 404));
    }

    // Xóa câu hỏi
    quiz.questions.pull(questionId); // Xóa câu hỏi khỏi mảng questions
    await quiz.save(); // Lưu thay đổi vào database

    // Trả về kết quả
    res.status(200).json({
        success: true,
        message: 'Question deleted successfully'
    });
});

// POST /api/quizzes/:quizId/questions - Create a new question in a quiz
export const createQuestion = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { text, type, points, options, correctAnswer } = req.body;

    // Kiểm tra id
    if (!id) {
        return next(new ErrorHandler('Please provide a quiz ID', 400));
    }

    // Kiểm tra dữ liệu đầu vào
    if (!text || !type || !points || !correctAnswer) {
        return next(new ErrorHandler('Please provide all required fields', 400));
    }

    if (type === 'single-choice' && (!options || !options.includes(correctAnswer))) {
        return next(new ErrorHandler('Correct answer must be one of the options', 400));
    }

    if (
        type === 'multiple-choice' &&
        (!Array.isArray(correctAnswer) || correctAnswer.some((ans) => !options.includes(ans)))
    ) {
        return next(new ErrorHandler('Each correct answer must be in the options', 400));
    }

    // Tìm quiz trong database
    const quiz = await Quiz.findById(id);
    if (!quiz) {
        return next(new ErrorHandler('Quiz not found', 404));
    }

    // Tạo câu hỏi mới
    const newQuestion = {
        text,
        type,
        points,
        options: type === 'single-choice' || type === 'multiple-choice' ? options : undefined,
        correctAnswer
    };

    // Thêm câu hỏi vào quiz
    quiz.questions.push(newQuestion);
    await quiz.save(); // Lưu thay đổi vào database
    console.log('Received data:', { text, type, points, options, correctAnswer });
    // Trả về kết quả
    res.status(201).json({
        success: true,
        message: 'Question created successfully',
        question: newQuestion
    });
});
