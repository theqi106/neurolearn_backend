import mongoose, { Schema } from 'mongoose';
import { ILevel } from '../interfaces/Level';

export const LevelSchema: Schema<ILevel> = new Schema({
    name: {
        type: String,
        required: [true, 'Please provide a category name'],
        maxLength: 100,
        minLength: 3,
        trim: true,
        lowercase: true
    },
    courses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }]
});

export default mongoose.models.Level || mongoose.model<ILevel>('Level', LevelSchema);
