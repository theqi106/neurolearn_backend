import express, { RequestHandler } from 'express';
import { isAuthenticated } from '../middlewares/auth/isAuthenticated';
import { authorizeRoles } from '../middlewares/auth/authorizeRoles';
import {
    addAnswer,
    addQuestion,
    addReplyToReview,
    addReview,
    deleteCourse,
    getAllCourses,
    getAllCoursesWithoutPurchase,
    getCoursesLimitWithPagination,
    getPurchasedCourseByUser,
    getSingleCourse,
    getTopCourses,
    getTopRatedCoursesController,
    updateCourse,
    uploadCourse,
    getCourseStatistics,
    getCoursesByUser,
    searchCoursesAndInstructors,
    getUploadedCourseByInstructor,
    createSection,
    reorderSection,
    updateSection,
    createLesson,
    reorderLesson,
    updateLesson,
    uploadLessonVideo,
    generateVideoCloudinarySignature,
    getSignatureForDelete,
    deleteLesson,
    publishLesson,
    unPublishLesson,
    publishSection,
    unpublishSection,
    deleteSection,
    publishCourse,
    unpublishCourse,
    getAllUploadedAndPurchasedCoursesOfInstructor,
    getAllPurchasedCoursesOfUser,
    getCoursesWithSort
} from '../controllers/course.controller';
import { getUserInfo, updateAccessToken } from '../controllers/user.controller';

const router = express.Router();

router.get('/user-courses', updateAccessToken, isAuthenticated, getCoursesByUser, getUserInfo);

router.get('/sort', getCoursesWithSort as RequestHandler);

router.post('/create-course', updateAccessToken, isAuthenticated, uploadCourse);

router.put('/update-course/:id', updateAccessToken, isAuthenticated, updateCourse);

router.get('/all-courses/:id', updateAccessToken, isAuthenticated, getTopRatedCoursesController);

router.put('/publish-course/:id', updateAccessToken, isAuthenticated, publishCourse);

router.put('/unpublish-course/:id', updateAccessToken, isAuthenticated, unpublishCourse);

router.get('/pagination', getCoursesLimitWithPagination);

router.get('/count', getCourseStatistics);

router.post('/search', searchCoursesAndInstructors);

router.get('/top-courses', getTopCourses);

router.get('/:id', getSingleCourse);

router.get('/', getAllCoursesWithoutPurchase);

router.get('/purchased/my-course', updateAccessToken, isAuthenticated, getAllPurchasedCoursesOfUser);

router.get('/purchased/:id', updateAccessToken, isAuthenticated, getPurchasedCourseByUser);

router.get('/uploaded/:id', updateAccessToken, isAuthenticated, getUploadedCourseByInstructor);

router.get(
    '/instructor/all',
    updateAccessToken,
    isAuthenticated,
    authorizeRoles('instructor', 'user'),
    getAllUploadedAndPurchasedCoursesOfInstructor
);

router.put('/add-question', updateAccessToken, isAuthenticated, addQuestion);

router.put('/add-answer', updateAccessToken, isAuthenticated, addAnswer);

router.put('/add-review/:id', updateAccessToken, isAuthenticated, addReview);

router.put('/add-reply', updateAccessToken, isAuthenticated, addReplyToReview);

// router.get('/top-courses', getTopCourses);

router.get('/get-courses', isAuthenticated, authorizeRoles('admin'), getAllCourses);

router.delete(
    '/delete-course/:id',
    updateAccessToken,
    isAuthenticated,
    authorizeRoles('instructor', 'admin'),
    deleteCourse
);

router.put('/create-section/:id', updateAccessToken, isAuthenticated, createSection);

router.put('/reorder-section/:id', updateAccessToken, isAuthenticated, reorderSection);

router.put('/update-section/:id', updateAccessToken, isAuthenticated, updateSection);

router.put('/create-lesson/:id', updateAccessToken, isAuthenticated, createLesson);

router.put('/reorder-lesson/:id', updateAccessToken, isAuthenticated, reorderLesson);

router.put('/update-lesson/:id', updateAccessToken, isAuthenticated, updateLesson);

router.put('/delete-lesson/:id', updateAccessToken, isAuthenticated, deleteLesson);

router.put('/publish-lesson/:id', updateAccessToken, isAuthenticated, publishLesson);

router.put('/unpublish-lesson/:id', updateAccessToken, isAuthenticated, unPublishLesson);

router.put('/publish-section/:id', updateAccessToken, isAuthenticated, publishSection);

router.put('/unpublish-section/:id', updateAccessToken, isAuthenticated, unpublishSection);

router.put('/delete-section/:id', updateAccessToken, isAuthenticated, deleteSection);

router.put('/upload-lesson-video/:id', updateAccessToken, isAuthenticated, uploadLessonVideo);

router.put('/upload-lesson-video/:id', updateAccessToken, isAuthenticated, uploadLessonVideo);

router.post('/sign-upload', generateVideoCloudinarySignature);

router.post('/sign-delete', getSignatureForDelete);

// Add new route for updating lesson completion status
// router.put('/update-lesson-completion/:id', updateAccessToken, isAuthenticated, updateLessonCompletionStatus);

export = router;
