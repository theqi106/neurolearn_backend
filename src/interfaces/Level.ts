import mongoose, { Document } from 'mongoose';

export interface ILevel extends Document {
    name: string;
    courses: [mongoose.Schema.Types.ObjectId];
}
