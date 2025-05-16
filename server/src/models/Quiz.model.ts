import mongoose, { Schema } from 'mongoose';
import { IQuiz, IQuestion } from '../interfaces/Quiz';

const questionSchema = new Schema<IQuestion>({
    text: { type: String, required: true },
    type: {
        type: String,
        required: true,
        enum: ['single-choice', 'multiple-choice']
    },
    points: { type: Number, required: true },
    options: {
        type: [String],
        required: function () {
            return (this as any).type === 'single-choice' || (this as any).type === 'multiple-choice';
        }
    },
    correctAnswer: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
        validate: {
            validator: function (v: any) {
                if ((this as any).type === 'single-choice') {
                    return (this as any).options.includes(v);
                } else if ((this as any).type === 'multiple-choice') {
                    return Array.isArray(v) && v.every((ans: any) => (this as any).options.includes(ans));
                }
                return false;
            },
            message: 'Incorrect answer format for this question type'
        }
    }
});

const quizSchema = new Schema<IQuiz>(
    {
        title: { type: String, required: true },
        description: { type: String },
        difficulty: {
            type: String,
            required: true,
            enum: ['easy', 'medium', 'hard']
        },
        duration: { type: Number, required: true },
        passingScore: { type: Number, required: true },
        maxAttempts: { type: Number, required: true },
        isPublished: { type: Boolean, default: false },
        instructorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        questions: [questionSchema],
        sectionOrder: { type: Number, required: false },
        lessonOrder: { type: Number, required: false },
        videoSection: { type: String, required: true },
        courseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course',
            required: true
        },
        userScores: [
            {
                user: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                    required: true
                },
                score: {
                    type: Number,
                    required: true,
                    default: 0
                },
                attemptedAt: { type: Date, default: Date.now }
            }
        ]
    },
    { timestamps: true }
);

export default mongoose.models.Quiz || mongoose.model<IQuiz>('Quiz', quizSchema);
