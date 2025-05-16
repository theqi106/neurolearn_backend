import cron from 'node-cron';
import NotificationModel from '../models/Notification.model';
import { catchAsync } from '../utils/catchAsync';
import ErrorHandler from '../utils/ErrorHandler';
import { NextFunction, Request, Response } from 'express';

export const getAllNotificationsByInstructor = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const notifications = await NotificationModel.find({
        authorId: req.user?._id
    }).sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        notifications
    });
});

export const updateNotificationStatus = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const notification = await NotificationModel.findById(req.params.id);
    if (!notification) {
        return next(new ErrorHandler('Notification not found', 404));
    }
    notification.status = 'read';

    await notification.save();

    const notifications = await NotificationModel.find({
        authorId: req.user?._id
    }).sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        notifications
    });
});

// cron delete notifications
cron.schedule('0 0 0 * * *', async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await NotificationModel.deleteMany({
        status: 'read',
        createdAt: { $lt: thirtyDaysAgo }
    });
});
