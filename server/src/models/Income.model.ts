import mongoose, { Schema, Document } from 'mongoose';

export interface IIncome extends Document {
    userId: mongoose.Schema.Types.ObjectId;
    totalIncome: number;
    totalPurchased: number;
    total: number[]; // Mảng 12 phần tử tương ứng với thu nhập mỗi tháng
}

const IncomeSchema = new Schema<IIncome>(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        totalIncome: {
            type: Number,
            default: 0
        },
        totalPurchased: {
            type: Number,
            default: 0
        },
        total: {
            type: [Number],
            default: Array(12).fill(0) // 12 tháng, mỗi tháng khởi tạo 0
        }
    },
    { timestamps: true }
);

export default mongoose.models.Income || mongoose.model<IIncome>('Income', IncomeSchema);
