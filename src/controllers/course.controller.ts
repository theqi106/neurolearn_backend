import mongoose from 'mongoose';
import cloudinary from 'cloudinary';
import ejs from 'ejs';

import { catchAsync } from '../utils/catchAsync';
import { NextFunction, Request, Response } from 'express';
import { createCourse, getAllCoursesService } from '../services/course.service';
import CourseModel from '../models/Course.model';
import ErrorHandler from '../utils/ErrorHandler';
import { redis } from '../utils/redis';
import path from 'path';
import sendMail from '../utils/sendMail';
import NotificationModel from '../models/Notification.model';
import LevelModel from '../models/Level.model';
import CategoryModel from '../models/Category.model';
import SubCategoryModel from '../models/SubCategory.model';
import UserModel from '../models/User.model';

export const getCoursesByUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?._id;
    if (!userId) {
        return next(new ErrorHandler('Unauthorized - user not found', 401));
    }

    // Lấy user để truy cập user.uploadedCourses
    const user = await UserModel.findById(userId).select('uploadedCourses');
    if (!user) {
        return next(new ErrorHandler('User not found', 404));
    }

    // uploadedCourses là mảng ObjectId/string => tìm tất cả các khóa học có _id thuộc mảng này
    const courses = await CourseModel.find({
        _id: { $in: user.uploadedCourses }
    });

    // Nếu muốn bắt lỗi khi không có course nào
    if (!courses || courses.length === 0) {
        return next(new ErrorHandler('No courses found for this user', 404));
    }

    return res.status(200).json({
        success: true,
        data: courses
    });
});
export const getTopRatedCoursesController = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id: instructorId } = req.params; // Lấy giá trị `id` từ req.params

    if (!instructorId) {
        return next(new ErrorHandler('Instructor not found', 404));
    }

    // Find top-rated courses by the specific instructor
    const topCourses = await CourseModel.find({ authorId: instructorId }) // Lọc đúng instructor
        .sort({ rating: -1 })
        .limit(10)
        .populate('authorId', 'name email')
        .populate('category', 'name')
        .lean();

    if (!topCourses || topCourses.length === 0) {
        return next(new ErrorHandler('No courses found', 404));
    }

    // Add lesson count and duration
    const coursesWithDetails = topCourses.map((course) => {
        const lessonsCount = course.courseData?.length || 0;
        const duration =
            course.courseData?.reduce(
                (acc: number, curr: { videoLength?: number }) => acc + (curr.videoLength ?? 0),
                0
            ) || 0;
        const durationInHours = (duration / 60).toFixed(1);

        return {
            ...course,
            lessonsCount,
            duration: `${durationInHours} hours`
        };
    });

    res.status(200).json({
        success: true,
        data: {
            topCourses: coursesWithDetails
        }
    });
});

export const getCoursesWithSort = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { type } = req.query;

    if (!type || (type !== 'recent' && type !== 'oldest' && type !== 'bestselling')) {
        return next(new ErrorHandler('Invalid type parameter. Use "recent", "oldest", or "bestselling".', 400));
    }

    let courses;

    if (type === 'recent') {
        const threeDaysAgo = new Date();
        threeDaysAgo.setUTCDate(threeDaysAgo.getUTCDate() - 3);

        courses = await CourseModel.find({ createdAt: { $gte: threeDaysAgo }, isPublished: 'true' })
            .sort({ createdAt: -1 })
            .limit(3);
    } else if (type === 'oldest') {
        courses = await CourseModel.find({ isPublished: 'true' }).sort({ createdAt: 1 }).limit(10);
    } else if (type === 'bestselling') {
        courses = await CourseModel.find({ isPublished: 'true' }).sort({ purchased: -1 }).limit(1);
    }

    res.status(200).json({
        success: true,
        courses: courses
    });
});

export const uploadCourse = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const data = req.body;

    createCourse(data, req, res, next);
});

export const updateCourse = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.id;

    if (!courseId) {
        return next(new ErrorHandler('Please provide a course id', 400));
    }

    const isCacheExist = await redis.get(courseId);
    let course;

    if (isCacheExist) {
        course = await JSON.parse(isCacheExist);
    } else {
        course = await CourseModel.findById(req.params.id);
        // .select(
        //     '-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links'
        // );
        redis.set(courseId, JSON.stringify(course));
    }

    const data = req.body;

    const thumbnail = data.thumbnail;
    if (thumbnail) {
        if (course?.thumbnail?.public_id) {
            await cloudinary.v2.uploader.destroy(course.thumbnail.public_id);
        }

        const myCloud = await cloudinary.v2.uploader.upload(thumbnail, {
            folder: 'courses'
        });

        data.thumbnail = {
            public_id: myCloud.public_id,
            url: myCloud.secure_url
        };
    }

    const courseAfterUpdated = await CourseModel.findByIdAndUpdate(courseId, { $set: data }, { new: true });

    redis.set(courseId, JSON.stringify(courseAfterUpdated));

    res.status(200).json({
        success: true,
        course: courseAfterUpdated
    });
});

// publish course
export const publishCourse = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.id;

    if (!courseId) {
        return next(new ErrorHandler('Please provide a course id', 400));
    }

    const isCacheExist = await redis.get(courseId);
    let course;

    if (isCacheExist) {
        course = await JSON.parse(isCacheExist);
    } else {
        course = await CourseModel.findById(req.params.id);
        redis.set(courseId, JSON.stringify(course));
    }

    const courseAfterUpdated = await CourseModel.findByIdAndUpdate(courseId, { isPublished: true }, { new: true });

    redis.set(courseId, JSON.stringify(courseAfterUpdated));

    res.status(200).json({
        success: true,
        course: courseAfterUpdated
    });
});

// unpublish course
export const unpublishCourse = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.id;

    if (!courseId) {
        return next(new ErrorHandler('Please provide a course id', 400));
    }

    const isCacheExist = await redis.get(courseId);
    let course;

    if (isCacheExist) {
        course = await JSON.parse(isCacheExist);
    } else {
        course = await CourseModel.findById(req.params.id);
        redis.set(courseId, JSON.stringify(course));
    }

    const courseAfterUpdated = await CourseModel.findByIdAndUpdate(courseId, { isPublished: false }, { new: true });

    redis.set(courseId, JSON.stringify(courseAfterUpdated));

    res.status(200).json({
        success: true,
        course: courseAfterUpdated
    });
});

// create section
export const createSection = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.id;

    if (!courseId) {
        return next(new ErrorHandler('Please provide a course id', 400));
    }

    const isCacheExist = await redis.get(courseId);
    let course;

    if (isCacheExist) {
        course = await JSON.parse(isCacheExist);
    } else {
        course = await CourseModel.findById(req.params.id);
        redis.set(courseId, JSON.stringify(course));
    }

    const section = {
        videoSection: req.body.title,
        sectionOrder: [...new Map(course.courseData.map((item: any) => [item.videoSection, item])).values()].length + 1
    };

    course.courseData.push(section);

    const courseAfterUpdated = await CourseModel.findByIdAndUpdate(courseId, { $set: course }, { new: true });

    redis.set(courseId, JSON.stringify(courseAfterUpdated));

    res.status(200).json({
        success: true,
        course: courseAfterUpdated
    });
});

// reorder section
export const reorderSection = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.id;

    if (!courseId) {
        return next(new ErrorHandler('Please provide a course id', 400));
    }

    const isCacheExist = await redis.get(courseId);
    let course;

    if (isCacheExist) {
        course = await JSON.parse(isCacheExist);
    } else {
        course = await CourseModel.findById(req.params.id);
        redis.set(courseId, JSON.stringify(course));
    }

    const data = req.body;

    course.courseData = course.courseData.map((b: any) => {
        const match = data.find((a: any) => a.title === b.videoSection);
        return match ? { ...b, sectionOrder: match.order } : b;
    });

    const courseAfterUpdated = await CourseModel.findByIdAndUpdate(courseId, { $set: course }, { new: true });
    redis.set(courseId, JSON.stringify(courseAfterUpdated));

    res.status(200).json({
        success: true,
        course: courseAfterUpdated
    });
});

// update section
export const updateSection = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.id;

    if (!courseId) {
        return next(new ErrorHandler('Please provide a course id', 400));
    }

    const isCacheExist = await redis.get(courseId);
    let course;

    if (isCacheExist) {
        course = await JSON.parse(isCacheExist);
    } else {
        course = await CourseModel.findById(req.params.id);
        redis.set(courseId, JSON.stringify(course));
    }

    const { oldTitle, title } = req.body;

    course.courseData = course.courseData.map((c: any) => {
        const match = c.videoSection === oldTitle;
        return match ? { ...c, videoSection: title } : c;
    });

    const courseAfterUpdated = await CourseModel.findByIdAndUpdate(courseId, { $set: course }, { new: true });
    redis.set(courseId, JSON.stringify(courseAfterUpdated));

    res.status(200).json({
        success: true,
        course: courseAfterUpdated
    });
});

// create lesson
export const createLesson = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.id;

    if (!courseId) {
        return next(new ErrorHandler('Please provide a course id', 400));
    }

    const isCacheExist = await redis.get(courseId);
    let course;

    if (isCacheExist) {
        course = await JSON.parse(isCacheExist);
    } else {
        course = await CourseModel.findById(req.params.id);
        redis.set(courseId, JSON.stringify(course));
    }

    const { title, videoSection } = req.body;

    const courseDataFilter = course.courseData.find((c: any) => {
        return c.videoSection === videoSection && !c.title;
    });

    if (courseDataFilter) {
        course.courseData = course.courseData.map((c: any) => {
            const match = c._id === courseDataFilter._id;
            return match ? { ...c, title: title, lessonOrder: 1 } : c;
        });
    } else {
        course.courseData.push({
            title,
            videoSection,
            isPublishedSection: course.courseData[0].isPublishedSection,
            sectionOrder: course.courseData.find((item: any) => item.videoSection === videoSection).sectionOrder || 0,
            lessonOrder: course.courseData.filter((c: any) => c.videoSection === videoSection).length + 1
        });
    }

    const courseAfterUpdated = await CourseModel.findByIdAndUpdate(courseId, { $set: course }, { new: true });
    redis.set(courseId, JSON.stringify(courseAfterUpdated));

    res.status(200).json({
        success: true,
        course: courseAfterUpdated
    });
});

// reorder lesson
export const reorderLesson = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.id;

    if (!courseId) {
        return next(new ErrorHandler('Please provide a course id', 400));
    }

    const isCacheExist = await redis.get(courseId);
    let course;

    if (isCacheExist) {
        course = await JSON.parse(isCacheExist);
    } else {
        course = await CourseModel.findById(req.params.id);
        redis.set(courseId, JSON.stringify(course));
    }

    const data = req.body;

    course.courseData = course.courseData.map((b: any) => {
        const match = data.find((a: any) => a.id === b._id);
        return match ? { ...b, lessonOrder: match.order } : b;
    });

    const courseAfterUpdated = await CourseModel.findByIdAndUpdate(courseId, { $set: course }, { new: true });
    redis.set(courseId, JSON.stringify(courseAfterUpdated));

    res.status(200).json({
        success: true,
        course: courseAfterUpdated
    });
});

// get single course without purchase
export const getSingleCourse = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.id;

    if (!courseId) {
        return next(new ErrorHandler('Please provide course id', 400));
    }

    let course = await CourseModel.findById(req.params.id)
        .populate('authorId')
        .select('-courseData.suggestion -courseData.questions -courseData.links');

    course.courseData = course.courseData.filter(
        (c: any) =>
            c?.videoUrl?.url && c?.title && c?.description && c?.isPublished && c?.isPublishedSection && c?.videoSection
    );

    const sortedCourseData = (course.courseData = course.courseData.sort((a: any, b: any) => {
        if (a.sectionOrder !== b.sectionOrder) {
            return a.sectionOrder - b.sectionOrder; // Sort by sectionOrder first
        }
        return a.lessonOrder - b.lessonOrder; // If sectionOrder is the same, sort by lessonOrder
    }));

    course.courseData = sortedCourseData;

    const modifiedCourseData = course.courseData.map((data: any) => {
        if (data.isFree) {
            return {
                ...data.toObject(), // Convert Mongoose document to plain object
                videoUrl: data.videoUrl // Include videoUrl
            };
        } else {
            return {
                ...data.toObject(),
                videoUrl: undefined // Exclude videoUrl
            };
        }
    });

    course = {
        ...course.toObject(),
        courseData: modifiedCourseData
    };

    if (!course) {
        return next(new ErrorHandler('Course not found', 404));
    }

    res.status(200).json({
        success: true,
        course
    });
});

// update lesson
export const updateLesson = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.id;

    if (!courseId) {
        return next(new ErrorHandler('Please provide a course id', 400));
    }

    const isCacheExist = await redis.get(courseId);
    let course;

    if (isCacheExist) {
        course = await JSON.parse(isCacheExist);
    } else {
        course = await CourseModel.findById(req.params.id);
        redis.set(courseId, JSON.stringify(course));
    }

    const data = req.body;

    const lesson = course.courseData.find((c: any) => c._id === data?.id);

    if (!lesson) {
        return next(new ErrorHandler('Lesson does not exist', 400));
    }

    // Update the lesson with new data
    course.courseData = course.courseData.map((c: any) => {
        const match = c._id === lesson._id;
        const changeData: {
            title: string;
            description: string;
            videoLength: number;
            isFree: boolean;
            videoUrl?: any;
            links?: [{ title: string; url: string }];
            isPublished?: boolean;
        } = {
            title: data.title,
            description: data.description,
            isFree: data.isFree,
            videoLength: data.duration
        };
        if (data.videoUrl) changeData.videoUrl = data.videoUrl;
        if (data.links) changeData.links = data.links;
        if (data.isPublished) changeData.isPublished = data.isPublished;
        return match ? { ...c, ...changeData } : c;
    });

    const courseAfterUpdated = await CourseModel.findByIdAndUpdate(courseId, { $set: course }, { new: true });
    redis.set(courseId, JSON.stringify(courseAfterUpdated));

    res.status(200).json({
        success: true,
        course: courseAfterUpdated
    });
});

// delete lesson
export const deleteLesson = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.id;

    if (!courseId) {
        return next(new ErrorHandler('Please provide a course id', 400));
    }

    const isCacheExist = await redis.get(courseId);
    let course;

    if (isCacheExist) {
        course = await JSON.parse(isCacheExist);
    } else {
        course = await CourseModel.findById(req.params.id);
        redis.set(courseId, JSON.stringify(course));
    }

    const data = req.body;

    const lesson = course.courseData.find((c: any) => c._id === data?.id);

    if (!lesson) {
        return next(new ErrorHandler('Lesson does not exist', 400));
    }
    const sections = course.courseData.filter((c: any) => c.videoSection === lesson.videoSection);
    // Delete lesson
    if (sections.length === 1) {
        course.courseData = course.courseData.map((c: any) => {
            const match = c._id === lesson._id;
            return match
                ? {
                      ...c,
                      title: null,
                      description: null,
                      videoLength: null,
                      isFree: false,
                      videoUrl: null,
                      links: [],
                      isPublished: false,
                      isPublishedSection: false
                  }
                : c;
        });
    } else {
        course.courseData = course.courseData.filter((c: any) => {
            return c._id !== lesson._id;
        });
    }

    const courseAfterUpdated = await CourseModel.findByIdAndUpdate(courseId, { $set: course }, { new: true });
    redis.set(courseId, JSON.stringify(courseAfterUpdated));

    res.status(200).json({
        success: true,
        course: courseAfterUpdated
    });
});

// publish lesson
export const publishLesson = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.id;

    if (!courseId) {
        return next(new ErrorHandler('Please provide a course id', 400));
    }

    const isCacheExist = await redis.get(courseId);
    let course;

    if (isCacheExist) {
        course = await JSON.parse(isCacheExist);
    } else {
        course = await CourseModel.findById(req.params.id);
        redis.set(courseId, JSON.stringify(course));
    }

    const data = req.body;

    const lesson = course.courseData.find((c: any) => c._id === data?.id);

    if (!lesson) {
        return next(new ErrorHandler('Lesson does not exist', 400));
    }

    if (!lesson.title || !lesson.description || !lesson.videoUrl) {
        return next(new ErrorHandler('Missing required fields', 400));
    }
    // publish lesson
    course.courseData = course.courseData.map((c: any) => {
        const match = c._id === lesson._id;
        return match
            ? {
                  ...c,
                  isPublished: true
              }
            : c;
    });

    const courseAfterUpdated = await CourseModel.findByIdAndUpdate(courseId, { $set: course }, { new: true });
    redis.set(courseId, JSON.stringify(courseAfterUpdated));

    res.status(200).json({
        success: true,
        course: courseAfterUpdated
    });
});

// unpublish lesson
export const unPublishLesson = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.id;

    if (!courseId) {
        return next(new ErrorHandler('Please provide a course id', 400));
    }

    const isCacheExist = await redis.get(courseId);
    let course;

    if (isCacheExist) {
        course = await JSON.parse(isCacheExist);
    } else {
        course = await CourseModel.findById(req.params.id);
        redis.set(courseId, JSON.stringify(course));
    }

    const data = req.body;

    const lesson = course.courseData.find((c: any) => c._id === data?.id);

    if (!lesson) {
        return next(new ErrorHandler('Lesson does not exist', 400));
    }

    if (!lesson.title || !lesson.description || !lesson.videoUrl) {
        return next(new ErrorHandler('Missing required fields', 400));
    }
    // publish lesson
    course.courseData = course.courseData.map((c: any) => {
        const match = c._id === lesson._id;
        return match
            ? {
                  ...c,
                  isPublished: false
              }
            : c;
    });

    const courseAfterUpdated = await CourseModel.findByIdAndUpdate(courseId, { $set: course }, { new: true });
    redis.set(courseId, JSON.stringify(courseAfterUpdated));

    res.status(200).json({
        success: true,
        course: courseAfterUpdated
    });
});

// publish section
export const publishSection = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.id;

    if (!courseId) {
        return next(new ErrorHandler('Please provide a course id', 400));
    }

    const isCacheExist = await redis.get(courseId);
    let course;

    if (isCacheExist) {
        course = await JSON.parse(isCacheExist);
    } else {
        course = await CourseModel.findById(req.params.id);
        redis.set(courseId, JSON.stringify(course));
    }

    const data = req.body;

    const sections = course.courseData.filter((c: any) => c.videoSection === data?.videoSection);

    if (sections.length === 0) {
        return next(new ErrorHandler('Section does not exist', 400));
    }

    // publish lesson
    course.courseData = course.courseData.map((c: any) => {
        const match = c.videoSection === data.videoSection;
        return match
            ? {
                  ...c,
                  isPublishedSection: true
              }
            : c;
    });

    const courseAfterUpdated = await CourseModel.findByIdAndUpdate(courseId, { $set: course }, { new: true });
    redis.set(courseId, JSON.stringify(courseAfterUpdated));

    res.status(200).json({
        success: true,
        course: courseAfterUpdated
    });
});

// unpublish section
export const unpublishSection = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.id;

    if (!courseId) {
        return next(new ErrorHandler('Please provide a course id', 400));
    }

    const isCacheExist = await redis.get(courseId);
    let course;

    if (isCacheExist) {
        course = await JSON.parse(isCacheExist);
    } else {
        course = await CourseModel.findById(req.params.id);
        redis.set(courseId, JSON.stringify(course));
    }

    const data = req.body;

    const sections = course.courseData.filter((c: any) => c.videoSection === data?.videoSection);

    if (sections.length === 0) {
        return next(new ErrorHandler('Section does not exist', 400));
    }

    // publish lesson
    course.courseData = course.courseData.map((c: any) => {
        const match = c.videoSection === data.videoSection;
        return match
            ? {
                  ...c,
                  isPublishedSection: false
              }
            : c;
    });

    const courseAfterUpdated = await CourseModel.findByIdAndUpdate(courseId, { $set: course }, { new: true });
    redis.set(courseId, JSON.stringify(courseAfterUpdated));

    res.status(200).json({
        success: true,
        course: courseAfterUpdated
    });
});

// delete section
export const deleteSection = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.id;

    if (!courseId) {
        return next(new ErrorHandler('Please provide a course id', 400));
    }

    const isCacheExist = await redis.get(courseId);
    let course;

    if (isCacheExist) {
        course = await JSON.parse(isCacheExist);
    } else {
        course = await CourseModel.findById(req.params.id);
        redis.set(courseId, JSON.stringify(course));
    }

    const data = req.body;

    const sections = course.courseData.filter((c: any) => c.videoSection === data?.videoSection);

    if (sections.length === 0) {
        return next(new ErrorHandler('Section does not exist', 400));
    }

    course.courseData = course.courseData.filter((c: any) => {
        return c.videoSection !== data.videoSection;
    });

    const courseAfterUpdated = await CourseModel.findByIdAndUpdate(courseId, { $set: course }, { new: true });
    redis.set(courseId, JSON.stringify(courseAfterUpdated));

    res.status(200).json({
        success: true,
        course: courseAfterUpdated
    });
});

// upload video lesson

export const uploadLessonVideo = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.id;

    if (!courseId) {
        return next(new ErrorHandler('Please provide a course id', 400));
    }

    const isCacheExist = await redis.get(courseId);
    let course;

    if (isCacheExist) {
        course = await JSON.parse(isCacheExist);
    } else {
        course = await CourseModel.findById(req.params.id);
        redis.set(courseId, JSON.stringify(course));
    }

    const data = req.body;

    const video = data.video;

    const lesson = course?.courseData.find((c: any) => c._id === data.id);

    if (video && lesson) {
        if (lesson?.videoUrl?.public_id) {
            await cloudinary.v2.uploader.destroy(lesson.videoUrl.public_id);
        }

        const myCloud = await cloudinary.v2.uploader.upload(video, {
            folder: 'lessons'
        });

        data.videoUrl = {
            public_id: myCloud.public_id,
            url: myCloud.secure_url
        };

        course.courseData = course.courseData.map((c: any) => {
            const match = c._id === lesson._id;
            return match
                ? {
                      ...c,
                      videoUrl: {
                          public_id: myCloud.public_id,
                          url: myCloud.secure_url
                      }
                  }
                : c;
        });
    }

    const courseAfterUpdated = await CourseModel.findByIdAndUpdate(courseId, { $set: course }, { new: true });
    redis.set(courseId, JSON.stringify(courseAfterUpdated));

    res.status(200).json({
        success: true,
        course: courseAfterUpdated
    });

    res.status(200).json({
        success: true,
        course: courseAfterUpdated
    });
});

// get all courses without purchase
export const getAllCoursesWithoutPurchase = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const isCacheExist = await redis.get(`allCourses ${req.user?._id}`);
    let courses;

    if (isCacheExist) {
        courses = JSON.parse(isCacheExist);
    } else {
        const courses = await CourseModel.find({ isPublished: true }).select(
            '-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links'
        );
        redis.set(`allCourses ${req.user?._id}`, JSON.stringify(courses));
    }

    res.status(200).json({
        success: true,
        courses
    });
});

// get course content -- only for valid user
export const getPurchasedCourseByUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const userCourseList = req.user?.purchasedCourses;
    const courseId = req.params.id;

    // Check if the user has purchased the course
    const courseExists = userCourseList?.find((c: any) => c === courseId.toString());
    if (!courseExists) {
        return next(new ErrorHandler('You are not eligible to access this course', 404));
    }

    // Fetch the course
    const course = await CourseModel.findById(courseId).populate({
        path: 'courseData.quizzes',
        model: 'Quiz'
    });

    if (!course) {
        return next(new ErrorHandler('Course not found', 404));
    }

    // Filter out unpublished or invalid course data
    course.courseData = course.courseData.filter(
        (c: any) => c?.title && c?.description && c?.isPublished && c?.isPublishedSection && c?.videoSection
    );

    // Sort courseData by sectionOrder and lessonOrder
    const sortedCourseData = course.courseData.sort((a: any, b: any) => {
        if (a.sectionOrder !== b.sectionOrder) {
            return a.sectionOrder - b.sectionOrder; // Sort by sectionOrder first
        }
        return a.lessonOrder - b.lessonOrder; // If sectionOrder is the same, sort by lessonOrder
    });

    // Group courseData by section
    const sections: { [key: string]: any[] } = {};
    sortedCourseData.forEach((item: any) => {
        if (!sections[item.videoSection]) {
            sections[item.videoSection] = [];
        }
        sections[item.videoSection].push(item);
    });

    // Insert quizzes into the correct position in each section and calculate section durations
    const finalCourseData: any[] = [];
    for (const sectionName in sections) {
        const sectionItems = sections[sectionName];

        // Calculate total duration of videos in the section
        const sectionVideoLength = sectionItems.reduce(
            (totalLength: number, item: any) => totalLength + (item?.videoLength || 0),
            0
        );

        // Find the quizzes for this section and calculate their total duration
        const quizzes = sectionItems.flatMap((item: any) => item.quizzes);
        const sectionQuizDuration = quizzes.reduce(
            (totalDuration: number, quiz: any) => totalDuration + (quiz.duration || 0),
            0
        );

        // Total section duration
        const totalSectionLength = sectionVideoLength + sectionQuizDuration;

        // Add lessons to the final course data
        finalCourseData.push(...sectionItems);

        // Add quizzes to the final course data (at the end of the section)
        if (quizzes.length > 0) {
            finalCourseData.push({
                _id: `quiz-section-${sectionName}`,
                title: `Quiz for ${sectionName}`,
                description: `Quiz for ${sectionName}`,
                videoSection: sectionName,
                isQuiz: true, // Flag to identify quizzes
                quizzes: quizzes,
                sectionOrder: sectionItems[0].sectionOrder,
                lessonOrder: sectionItems.length + 1, // Place quizzes at the end of the section
                videoLength: sectionQuizDuration // Assign quiz duration to videoLength for consistency
            });
        }

        // Add section duration to each section item
        sectionItems.forEach((item: any) => {
            item.sectionDuration = totalSectionLength;
        });
    }

    // Update the course data with the final structure
    course.courseData = finalCourseData;

    res.status(200).json({
        success: true,
        course
    });
});

// get uploaded course by instructor
export const getUploadedCourseByInstructor = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const userCourseList = req.user?.uploadedCourses;
    const courseId = req.params.id;

    const courseExists = userCourseList?.find((c: any) => c === courseId.toString());

    if (!courseExists) {
        return next(new ErrorHandler('You are not eligible to access this course', 404));
    }

    const course = await CourseModel.findById(courseId);

    course.courseData = course.courseData.sort((a: any, b: any) => {
        if (a.sectionOrder !== b.sectionOrder) {
            return a.sectionOrder - b.sectionOrder; // Sort by sectionOrder first
        }
        return a.lessonOrder - b.lessonOrder; // If sectionOrder is the same, sort by lessonOrder
    });

    res.status(200).json({
        success: true,
        course
    });
});

// get uploaded courses & purchased courses of instructor
export const getAllUploadedAndPurchasedCoursesOfInstructor = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const user = await UserModel.findById(req?.user?._id);

        if (!user) {
            return next(new ErrorHandler('User not found', 404));
        }

        const purchasedCourses = await CourseModel.find({
            _id: { $in: user.purchasedCourses }
        }).select('-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links');

        const uploadedCourses = await CourseModel.find({
            _id: { $in: user.uploadedCourses }
        }).select('-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links');

        res.status(200).json({
            success: true,
            purchasedCourses,
            uploadedCourses
        });
    }
);

// add question in course
interface IAddQuestionData {
    question: string;
    courseId: string;
    contentId: string;
}

export const addQuestion = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { question, courseId, contentId } = req.body as IAddQuestionData;
    const course = await CourseModel.findById(courseId);

    if (!mongoose.Types.ObjectId.isValid(contentId)) {
        return next(new ErrorHandler('Invalid content Id', 400));
    }

    const courseContent = course?.courseData?.find((c: any) => c._id.equals(contentId));

    if (!courseContent) {
        return next(new ErrorHandler('Course content is not exist', 400));
    }

    const newQuestion: any = {
        user: req.user,
        question,
        questionReplies: []
    };

    courseContent.questions.push(newQuestion);

    await NotificationModel.create({
        user: req.user?._id,
        title: 'New Question Received',
        message: `You have a new question in ${courseContent.title}`,
        courseId: course._id,
        authorId: course.authorId
    });

    await course?.save();

    res.status(200).json({
        success: true,
        course
    });
});

// add answer in course question
interface IAddAnswerData {
    answer: string;
    courseId: string;
    contentId: string;
    questionId: string;
}

interface CourseFilter {
    isPublished: boolean;
    level?: mongoose.Types.ObjectId;
    category?: mongoose.Types.ObjectId;
    subCategory?: mongoose.Types.ObjectId;
    authorId?: mongoose.Types.ObjectId;
    rating?: number;
    language?: string;
    price?: any;
}

export const addAnswer = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { answer, courseId, contentId, questionId } = req.body as IAddAnswerData;
    const course = await CourseModel.findById(courseId);

    if (!mongoose.Types.ObjectId.isValid(contentId)) {
        return next(new ErrorHandler('Invalid content Id', 400));
    }

    const courseContent = course?.courseData?.find((c: any) => c._id.equals(contentId));

    if (!courseContent) {
        return next(new ErrorHandler('Course content is not exist', 400));
    }

    const question = courseContent?.questions?.find((q: any) => q._id.equals(questionId));

    if (!question) {
        return next(new ErrorHandler('Invalid question Id', 400));
    }

    // create new answer object
    const newAnswer: any = {
        user: req.user,
        answer
    };

    //  add answer to course content
    question.questionReplies.push(newAnswer);

    await course?.save();

    if (req.user?._id === question.user._id) {
        // create a notification
        await NotificationModel.create({
            user: req.user?._id,
            title: 'New Question Reply Received',
            message: `You have a new question reply in ${courseContent.title}`,
            courseId: course._id,
            authorId: course.authorId
        });
    } else {
        const data = {
            name: question.user.name,
            title: courseContent.title
        };

        await ejs.renderFile(path.join(__dirname, '../mails/question-reply.ejs'), data);

        try {
            await sendMail({
                email: question.user.email,
                subject: 'Question Reply',
                template: 'question-reply.ejs',
                data
            });
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 500));
        }
    }
    res.status(200).json({
        success: true,
        course
    });
});

// add review for course
interface IAddReviewData {
    review: string;
    rating: number;
    userId: string;
}

export const addReview = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const userCourseList = req.user?.purchasedCourses;

    const courseId = req.params.id;

    const courseExists = userCourseList?.some((c: any) => c === courseId.toString());

    if (!courseExists) {
        return next(new ErrorHandler('You are not eligible to access this course', 404));
    }

    const course = await CourseModel.findById(courseId);

    if (!course) {
        return next(new ErrorHandler('Course not found', 404));
    }

    const { rating, review } = req.body as IAddReviewData;

    const reviewData: any = {
        user: req.user,
        rating,
        comment: review
    };

    course?.reviews.push(reviewData);

    // Calculate rating
    let totalRating = 0;

    course?.reviews.forEach((review: any) => {
        totalRating += review.rating;
    });

    course.rating = totalRating / course?.reviews.length;

    await course.save();

    await redis.set(courseId, JSON.stringify(course), 'EX', 604800);

    // create notification

    const notification = {
        user: req.user?._id,
        title: 'New Review Received',
        message: `${req.user?.name} has given review in ${course?.name}`,
        courseId: course._id,
        authorId: course.authorId
    };

    await NotificationModel.create(notification);

    res.status(200).json({
        success: true,
        course
    });
});

// add reply in review
interface IAddReviewData {
    comment: string;
    courseId: string;
    reviewId: string;
}

export const addReplyToReview = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { comment, courseId, reviewId } = req.body as IAddReviewData;

    const course = await CourseModel.findById(courseId);

    if (!course) {
        return next(new ErrorHandler('Course not found', 404));
    }

    const review = course?.reviews?.find((r: any) => r._id.toString() === reviewId.toString());

    if (!review) {
        return next(new ErrorHandler('Review not found', 404));
    }

    const replyData: any = {
        user: req.user,
        comment
    };

    if (!review.commentReplies) {
        review.commentReplies = [];
    }

    review.commentReplies.push(replyData);

    await course.save();

    await redis.set(courseId, JSON.stringify(course), 'EX', 604800);

    res.status(200).json({
        success: true,
        course
    });
});

// get all courses -- for admin
export const getAllCourses = catchAsync(async (req: Request, res: Response, next: NextFunction) => [
    getAllCoursesService(res)
]);

// delete course -- for admin
export const deleteCourse = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    // Find the course by ID
    const course = await CourseModel.findById(id);

    if (!course) {
        return next(new ErrorHandler('Course not found', 404));
    }

    // If the course has a thumbnail, delete it from Cloudinary
    if (course?.thumbnail?.public_id) {
        await cloudinary.v2.uploader.destroy(course.thumbnail.public_id);
    }

    // Delete the course
    await course.deleteOne({ id });

    // Update users who have purchased the course
    await UserModel.updateMany(
        { purchasedCourses: id }, // Find users with the course ID
        { $pull: { purchasedCourses: id } } // Remove the course ID from purchasedCourses
    );

    // Update users who uploaded the course
    await UserModel.updateMany(
        { uploadedCourses: id }, // Find users with the uploaded course ID
        { $pull: { uploadedCourses: id } } // Remove the course ID from uploadedCourses
    );

    // Optionally, delete the course ID from Redis cache
    await redis.del(id);

    // Respond with success message
    res.status(200).json({
        success: true,
        message: 'Course deleted successfully'
    });
});

//get courses -- pagination

export const getCoursesLimitWithPagination = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const skip = (page - 1) * limit;

    const filter: CourseFilter = { isPublished: true };

    if (req.query.level) {
        const levelDoc = await LevelModel.findOne({ name: new RegExp(`^${req.query.level}$`, 'i') });
        if (levelDoc) filter.level = levelDoc._id;
    }

    if (req.query.category) {
        const categoryDoc = await CategoryModel.findOne({ title: new RegExp(`^${req.query.category}$`, 'i') });
        if (categoryDoc) filter.category = categoryDoc._id;
    }

    if (req.query.subCategory) {
        const subCategoryDoc = await SubCategoryModel.findOne({ title: new RegExp(`^${req.query.subCategory}$`, 'i') });
        if (subCategoryDoc) filter.subCategory = subCategoryDoc._id;
    }

    if (req.query.authorId) {
        const authorDoc = await UserModel.findOne({ name: new RegExp(`^${req.query.authorId}$`, 'i') });
        if (authorDoc) filter.authorId = authorDoc._id;
    }

    // Filter rating
    if (req.query.rating) {
        const rating = parseInt(req.query.rating as string, 10);
        if (!isNaN(rating) && rating >= 1 && rating <= 5) {
            filter.rating = rating;
        }
    }

    // Filter language
    if (req.query.language) {
        filter.language = req.query.language as string;
    }

    // Filter price (Free or Paid)
    if (req.query.price) {
        if (req.query.price === 'Free') {
            filter.price = 0;
        } else if (req.query.price === 'Paid') {
            filter.price = { $gt: 0 };
        }
    }

    const courses = await CourseModel.find(filter)
        .select('-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links')
        .populate('authorId', 'name')
        .skip(skip)
        .limit(limit);

    const totalCourses = await CourseModel.countDocuments(filter);

    res.status(200).json({
        success: true,
        page,
        limit,
        totalCourses,
        totalPages: Math.ceil(totalCourses / limit),
        courses
    });
});

// get courses statistics
export const getCourseStatistics = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const courses = await CourseModel.find({ isPublished: true })
        .populate('category', 'title')
        .populate('subCategory', 'title')
        .populate('authorId', 'name')
        .populate('level', 'name');

    const formatCategoryData = () => ({
        title: 'Categories',
        data: courses.reduce((acc, course) => {
            const categoryLabel = course.category?.title || 'Unknown';
            const subCategoryLabel = course.subCategory?.title || 'Unknown';

            let categoryItem = acc.find((item: any) => item.label === categoryLabel);
            if (!categoryItem) {
                categoryItem = { label: categoryLabel, count: 0, subCategories: [] };
                acc.push(categoryItem);
            }

            categoryItem.count += 1;

            const subCategoryItem = categoryItem.subCategories.find((sub: any) => sub.label === subCategoryLabel);
            if (subCategoryItem) {
                subCategoryItem.count += 1;
            } else {
                categoryItem.subCategories.push({ label: subCategoryLabel, count: 1 });
            }

            return acc;
        }, [])
    });

    const formatData = (field: string, title: string) => ({
        title,
        data: courses.reduce((acc, course) => {
            const fieldValue = course[field]?.title || course[field]?.name || course[field] || 'Unknown';
            const existing = acc.find((item: any) => item.label === fieldValue);
            if (existing) {
                existing.count += 1;
            } else {
                acc.push({ label: fieldValue, count: 1 });
            }
            return acc;
        }, [])
    });

    const formatRatingData = () => ({
        title: 'Rating',
        data: [
            { label: '1', min: 0, max: 1 },
            { label: '2', min: 1, max: 2 },
            { label: '3', min: 2, max: 3 },
            { label: '4', min: 3, max: 4 },
            { label: '5', min: 4, max: 5 }
        ].map(({ label, min, max }) => ({
            label,
            count: courses.filter((course) => course.rating > min && course.rating <= max).length
        }))
    });

    const formatPriceData = () => ({
        title: 'Price',
        data: [
            { label: 'Free', count: courses.filter((course) => course.price === 0).length },
            { label: 'Paid', count: courses.filter((course) => course.price > 0).length }
        ]
    });

    const data = {
        categories: formatCategoryData(),
        authors: formatData('authorId', 'Author'),
        levels: formatData('level', 'Level'),
        ratings: formatRatingData(),
        price: formatPriceData(),
        languages: formatData('language', 'Language')
    };

    res.status(200).json({
        success: true,
        data
    });
});

export const getTopCourses = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const topCourses = await CourseModel.find({ isPublished: true })
        .sort({ rating: -1, purchased: -1 })
        .limit(10)
        .populate('authorId', 'name email')
        .populate('category', 'name')
        .lean();

    if (!topCourses || topCourses.length === 0) {
        return next(new ErrorHandler('No courses found', 404));
    }

    const coursesWithDetails = topCourses.map((course) => {
        const lessonsCount = course.courseData?.length || 0;

        const duration =
            course.courseData?.reduce((acc: number, curr: { videoLength?: number }) => {
                return acc + (curr.videoLength || 0);
            }, 0) || 0;

        const durationInHours = (duration / 60).toFixed(1);

        return {
            ...course,
            lessonsCount,
            duration: `${durationInHours} hours`
        };
    });

    res.status(200).json({
        success: true,
        data: {
            topCourses: coursesWithDetails
        }
    });
});

export const searchCoursesAndInstructors = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { search } = req.body;

    if (!search) {
        return res.status(400).json({
            success: false,
            message: 'Search query is required'
        });
    }

    const regex = new RegExp(search, 'i');

    const courses = await CourseModel.find({
        $or: [{ name: regex }, { description: regex }]
    })
        .select('name description authorId thumbnail')
        .populate('authorId', 'name role ');

    const instructors = await UserModel.find({
        name: regex,
        role: 'instructor'
    }).select('name role avatar');

    res.status(200).json({
        success: true,
        courses,
        instructors
    });
});
export const generateVideoCloudinarySignature = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { folder } = req.body;

    if (!folder) {
        return next(new ErrorHandler('Folder name is required', 400));
    }

    const timestamp = Math.round(new Date().getTime() / 1000);

    // Ensure you are signing all parameters you will send in the upload request
    const signature = cloudinary.v2.utils.api_sign_request(
        {
            timestamp,
            folder
        },
        process.env.CLOUD_API_SECRET || ''
    );

    res.status(200).json({ timestamp, signature });
});

export const getSignatureForDelete = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { publicId } = req.body;

    if (!publicId) {
        return next(new ErrorHandler('publicId is required', 400));
    }

    const timestamp = Math.round(new Date().getTime() / 1000);

    // Correct parameters for the signature
    const params = {
        public_id: publicId, // Use `public_id` (with underscore)
        timestamp: timestamp
    };

    // Generate the signature
    const signature = cloudinary.v2.utils.api_sign_request(params, process.env.CLOUD_API_SECRET || '');

    res.status(200).json({ timestamp, signature });
});

// update lesson completion status
export const updateLessonCompletionStatus = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.id;
    const { lessonId, isCompleted } = req.body;

    if (!courseId || !lessonId) {
        return next(new ErrorHandler('Course ID and Lesson ID are required', 400));
    }

    // Find the course
    const course = await CourseModel.findById(courseId);
    if (!course) {
        return next(new ErrorHandler('Course not found', 404));
    }

    // Find the lesson in courseData and update its isCompleted status
    const lesson = course.courseData.id(lessonId);
    if (!lesson) {
        return next(new ErrorHandler('Lesson not found', 404));
    }

    lesson.isCompleted = isCompleted;
    await course.save();

    // Update redis cache
    await redis.set(courseId, JSON.stringify(course));

    res.status(200).json({
        success: true,
        message: 'Lesson completion status updated successfully'
    });
});

// get purchased courses of user
export const getAllPurchasedCoursesOfUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    console.log(req?.user?.purchasedCourses);

    const course = await CourseModel.find({
        _id: { $in: req?.user?.purchasedCourses }
    })
        .populate('authorId', 'name email')
        .populate('category', 'name')
        .lean();
    if (!course) {
        return next(new ErrorHandler('Course not found', 404));
    }
    const coursesWithDetails = course.map((course) => {
        const lessonsCount = course.courseData?.length || 0;

        const duration =
            course.courseData?.reduce((acc: number, curr: { videoLength?: number }) => {
                return acc + (curr.videoLength || 0);
            }, 0) || 0;

        const durationInHours = (duration / 60).toFixed(1);

        return {
            ...course,
            lessonsCount,
            duration: `${durationInHours} hours`
        };
    });
    res.status(200).json({
        success: true,
        data: {
            course: coursesWithDetails
        }
    });
});
