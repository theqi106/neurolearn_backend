import mongoose, { Document } from 'mongoose';
import { UserT } from './User';

export interface IComment extends Document {
    user: UserT;
    question: string;
    questionReplies: IComment[];
}

export interface ICommentReply extends Document {
    user: UserT;
    answer: string;
}

export interface IReviewReply extends Document {
    user: UserT;
    rating: number;
    comment: string;
}
export interface IReview extends Document {
    user: UserT;
    rating: number;
    comment: string;
    commentReplies: IComment[];
}

export interface ILink extends Document {
    title: string;
    url: string;
}

export interface ICourseData extends Document {
    order: number;
    title: string;
    description: string;
    videoUrl: object;
    videoLength: number;
    videoPlayer: string;
    videoSection: string;
    links: ILink[];
    suggestion: string;
    questions: IComment[];
    quizzes: object[];
    isCompleted: boolean;
    isPublished: boolean;
    isPublishedSection: boolean;
    isFree: boolean;
    sectionOrder: number;
    lessonOrder: number;
}

export interface ICourse extends Document {
    name: string;
    subTitle: string;
    description?: string;
    price: number;
    estimatedPrice?: number;
    thumbnail: object;
    authorId: mongoose.Schema.Types.ObjectId;
    tags: string;
    level: mongoose.Schema.Types.ObjectId;
    demoUrl: string;
    benefits: { title: string }[];
    prerequisites: { title: string }[];
    reviews: IReview[];
    courseData: ICourseData[];
    rating?: number;
    purchased?: number;
    isPublished: boolean;
    isFree: boolean;
    category: mongoose.Schema.Types.ObjectId;
    subCategory: mongoose.Schema.Types.ObjectId;
}
