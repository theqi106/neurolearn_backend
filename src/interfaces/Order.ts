import mongoose, { Document } from 'mongoose';

export interface IOrder extends Document {
    courseIds: [mongoose.Schema.Types.ObjectId];
    userId: mongoose.Schema.Types.ObjectId;
    payment_info: object;
}
