import mongoose, { Document } from 'mongoose';

export interface IProgress extends Document {
    user: mongoose.Schema.Types.ObjectId;
    course: mongoose.Schema.Types.ObjectId;
    totalLessons: number;
    totalCompleted: number;
    completedLessons: {
        section: {
            name: string;
            sectionLength: number;
            lessons: mongoose.Schema.Types.ObjectId[];
            totalCompletedPerSection?: number;
        };
    }[];
}
