import mongoose, { Schema } from 'mongoose';
import { IComment, ICourse, ICourseData, ILink, IReview, IReviewReply } from '../interfaces/Course';

const ReviewReplySchema = new Schema<IReviewReply>(
    {
        user: Object,
        comment: String
    },
    { timestamps: true }
);

const ReviewSchema = new Schema<IReview>(
    {
        user: Object,
        rating: {
            type: Number,
            default: 0
        },
        comment: String,
        commentReplies: [ReviewReplySchema]
    },
    { timestamps: true }
);

const LinkSchema = new Schema<ILink>({
    title: String,
    url: String
});

const CommentSchema = new Schema<IComment>({
    user: Object,
    question: String,
    questionReplies: [Object]
});

const CourseDataSchema = new Schema<ICourseData>({
    order: Number,
    title: String,
    description: String,
    videoUrl: {
        public_id: {
            type: String
        },
        url: {
            type: String
        }
    },
    videoPlayer: String,
    videoSection: { type: String },
    videoLength: Number,
    links: [LinkSchema],
    suggestion: String,
    questions: [CommentSchema],
    quizzes: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Quiz'
        }
    ],
    isCompleted: { type: Boolean, default: false },
    isPublished: { type: Boolean, default: false },
    isPublishedSection: { type: Boolean, default: false },
    isFree: { type: Boolean, default: false },
    sectionOrder: Number,
    lessonOrder: Number
});

const CourseSchema = new Schema<ICourse>(
    {
        name: {
            type: String,
            required: true
        },
        subTitle: {
            type: String
        },
        description: {
            type: String
        },
        authorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Author is required']
        },
        price: {
            type: Number
        },
        estimatedPrice: {
            type: Number
        },
        thumbnail: {
            public_id: {
                type: String
            },
            url: {
                type: String
            }
        },
        tags: {
            type: String
        },
        level: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Level'
        },
        demoUrl: {
            public_id: {
                type: String
            },
            url: {
                type: String
            }
        },
        benefits: [{ title: String }],
        prerequisites: [{ title: String }],
        reviews: [ReviewSchema],
        courseData: [CourseDataSchema],
        rating: {
            type: Number,
            default: 0
        },
        purchased: {
            type: Number,
            default: 0
        },
        isPublished: { type: Boolean, default: false },
        isFree: { type: Boolean, default: false },
        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Category'
        },
        subCategory: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'SubCategory'
        }
    },
    { timestamps: true }
);

export default mongoose.models.Course || mongoose.model<ICourse>('Course', CourseSchema);
