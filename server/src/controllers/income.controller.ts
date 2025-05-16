import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import IncomeModel from '../models/Income.model';
import OrderModel from '../models/Order.model';
import ErrorHandler from '../utils/ErrorHandler';
import { catchAsync } from '../utils/catchAsync';

export const getUserIncome = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return next(new ErrorHandler('Invalid user ID', 400));
    }

    const orders = await OrderModel.find({}).populate({
        path: 'courseIds',
        select: 'authorId price purchased createdAt'
    });

    const monthlyIncome = Array(12).fill(0);
    const monthlyPurchased = Array(12).fill(0);
    let totalIncome = 0;
    let totalPurchased = 0;

    orders.forEach((order) => {
        order.courseIds.forEach((course: any) => {
            if (course.authorId.toString() === userId) {
                const month = new Date(order.createdAt).getMonth();
                const income = course.price * course.purchased;
                const incomeAfterCommission = income * 0.9;

                monthlyIncome[month] += incomeAfterCommission;
                monthlyPurchased[month] += course.purchased;

                totalIncome += incomeAfterCommission;
                totalPurchased += course.purchased;
            }
        });
    });

    const incomeData = await IncomeModel.findOneAndUpdate(
        { userId },
        {
            totalIncome,
            totalPurchased,
            total: monthlyIncome
        },
        { new: true, upsert: true }
    );

    res.status(200).json({
        success: true,
        incomeData
    });
});
