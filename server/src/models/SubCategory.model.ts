import mongoose, { Schema } from 'mongoose';
import { ISubCategory } from '../interfaces/SubCategory';

export const SubCategorySchema: Schema<ISubCategory> = new Schema({
    title: {
        type: String,
        required: [true, 'Please provide a sub category name'],
        maxLength: 100,
        minLength: 3,
        trim: true
        // unique: true
    },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    courses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }]
});

export default mongoose.models.SubCategory || mongoose.model<ISubCategory>('SubCategory', SubCategorySchema);
