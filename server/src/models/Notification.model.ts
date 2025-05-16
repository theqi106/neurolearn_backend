import { INotification } from '../interfaces/Notification';
import mongoose, { Schema } from 'mongoose';

const NotificationSchema = new Schema<INotification>(
    {
        title: {
            type: String,
            required: true
        },
        message: {
            type: String,
            required: true
        },
        status: {
            type: String,
            required: true,
            default: 'unread'
        },
        courseId: {
            type: String,
            required: true
        },
        authorId: {
            type: String,
            required: true
        }
    },
    { timestamps: true }
);

export default mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema);
