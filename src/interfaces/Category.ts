import mongoose, { Document } from 'mongoose';

export interface ICategory extends Document {
    title: string;
    courses: [mongoose.Schema.Types.ObjectId];
}
