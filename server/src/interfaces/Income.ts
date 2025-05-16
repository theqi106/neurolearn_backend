import mongoose, { Document } from 'mongoose';

export interface IMonthlyIncome extends Document {
    userId: mongoose.Types.ObjectId;
    totalIncome: number;
    totalPurchased: number;
    monthlyIncome: number[];
    commissionRate: number;
}
