import { Document, Types } from 'mongoose';

export interface IQuestion {
    questionId: Types.ObjectId;
    text: string;
    type: 'multiple-choice' | 'true/false' | 'short-answer';
    points: number;
    options?: string[];
    correctAnswer: string | number;
}

export interface IQuiz extends Document {
    title: string;
    description?: string;
    difficulty: 'easy' | 'medium' | 'hard';
    duration: number;
    passingScore: number;
    maxAttempts: number;
    isPublished: boolean;
    instructorId: Types.ObjectId;
    questions: IQuestion[];
    sectionOrder: number;
    lessonOrder: number;
    videoSection: string;
    courseId: Types.ObjectId;
    userScores: IUserScore[];
    calculateUserScore(userAnswers: any[]): number;
    saveUserScore(userId: Types.ObjectId, score: number): Promise<IQuiz>;
}

export interface IUserScore {
    user: Types.ObjectId;
    score: number;
    attemptedAt: Date;
}
