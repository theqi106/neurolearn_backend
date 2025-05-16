import mongoose, { Document } from 'mongoose';

export interface ISubCategory extends Document {
    title: string;
    categoryId: mongoose.Schema.Types.ObjectId;
    courses: [mongoose.Schema.Types.ObjectId];
}
