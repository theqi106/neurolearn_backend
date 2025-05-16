import { IProgress } from '../interfaces/Progress';
import mongoose, { Schema } from 'mongoose';

// Schema của Progress
const ProgressSchema = new Schema<IProgress>(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        course: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course',
            required: true
        },
        totalLessons: {
            type: Number,
            required: true
        },
        totalCompleted: {
            type: Number,
            required: true,
            default: 0
        },
        completedLessons: [
            {
                section: {
                    name: { type: String, required: true },
                    sectionLength: { type: Number, required: true },
                    lessons: [
                        {
                            type: mongoose.Schema.Types.ObjectId,
                            ref: 'Lesson'
                        }
                    ],
                    totalCompletedPerSection: {
                        type: Number,
                        default: function (this: any) {
                            return this.lessons ? this.lessons.length : 0;
                        }
                    }
                }
            }
        ]
    },
    { timestamps: true }
);

// Middleware để cập nhật totalCompleted tự động
ProgressSchema.pre('save', function (next) {
    this.totalCompleted = this.completedLessons.reduce((total, section) => {
        return total + (section.section.lessons?.length || 0);
    }, 0);
    next();
});

export default mongoose.models.Progress || mongoose.model<IProgress>('Progress', ProgressSchema);
