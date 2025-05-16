import { ICategory } from '../interfaces/Category';
import mongoose, { Schema } from 'mongoose';

export const CategorySchema: Schema<ICategory> = new Schema({
    title: {
        type: String,
        required: [true, 'Please provide a category name'],
        maxLength: 100,
        minLength: 3,
        trim: true
        // unique: true
    },
    courses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }]
});

export default mongoose.models.Category || mongoose.model<ICategory>('Category', CategorySchema);
