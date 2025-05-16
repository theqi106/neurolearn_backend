import { RedisKey } from 'ioredis';
import cloudinary from 'cloudinary';
import jwt, { JwtPayload, Secret } from 'jsonwebtoken';
import ejs from 'ejs';
import dotenv from 'dotenv';
import UserModel from '../models/User.model';
import { catchAsync } from '../utils/catchAsync';
import ErrorHandler from '../utils/ErrorHandler';
import { NextFunction, Request, Response } from 'express';

import path from 'path';
import sendMail from '../utils/sendMail';
import { UserT } from '../interfaces/User';
import { accessTokenOptions, refreshTokenOptions, sendToken } from '../utils/jwt';
import { redis } from '../utils/redis';
import {
    getUserById,
    getAllUsersService,
    updateUserRoleService,
    getAllInstructorsService
} from '../services/user.service';

dotenv.config();

interface IRegistrationBody {
    name: string;
    email: string;
    password: string;
    avatar?: string;
}

interface IActivationToken {
    token: string;
    activationCode: string;
}

interface IActivationRequest {
    activation_token: string;
    activation_code: string;
}

interface IResetCode {
    reset_token: string;
    reset_code: string;
}

interface ILoginRequest {
    email: string;
    password: string;
}

interface ISocialAuthBody {
    email: string;
    name: string;
    avatar: string;
}

interface IUpdateUserInfo {
    name?: string;
    avatar: string;
    email: string;
    age: number;
    profession: string;
    introduce: string;
    address: string;
    phoneNumber: string;
    rating: number;
    student: number;
}

interface IUpdatePassword {
    oldPassword: string;
    newPassword: string;
}

interface IProfilePicture {
    avatar: string;
}

export const getUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.params.id;

    if (!userId) {
        return next(new ErrorHandler('Please provide a user ID', 400));
    }

    const user = await UserModel.findById(userId).populate('uploadedCourses'); // Populate uploadedCourses

    if (!user) {
        return next(new ErrorHandler('User not found', 404));
    }
    const uploadedCoursesCount = Array.isArray(user.uploadedCourses) ? user.uploadedCourses.length : 0;
    res.status(200).json({
        success: true,
        data: {
            user,
            uploadedCoursesCount
        }
    });
});

export const updateUserSocialLinks = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { data } = req.body; // Đảm bảo rằng bạn nhận được đúng đối tượng `socialLinks`
    const userId = req.user?._id as RedisKey;
    const user = await UserModel.findById(userId);

    if (!user) {
        return next(new ErrorHandler('User not found', 404));
    }

    // Cập nhật các liên kết mạng xã hội
    if (data.facebook) user.socialLinks.facebook = data.facebook;
    if (data.twitter) user.socialLinks.twitter = data.twitter;
    if (data.linkedin) user.socialLinks.linkedin = data.linkedin;
    if (data.instagram) user.socialLinks.instagram = data.instagram;

    // Lưu thông tin vào database
    await user.save();

    // Lưu lại dữ liệu vào Redis
    await redis.del(userId);

    await redis.set(userId, JSON.stringify(user));

    // Trả về kết quả thành công
    res.status(200).json({
        success: true,
        user
    });
});

export const registrationUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { name, email, password } = req.body;

    const isEmailExist = await UserModel.findOne({ email });
    if (isEmailExist) return next(new ErrorHandler('Email already exist', 400));

    const user: IRegistrationBody = {
        name,
        email,
        password
    };

    const activationToken = createActivationToken(user);

    const activationCode = activationToken.activationCode;

    const data = { user: { name: user.name }, activationCode };
    await ejs.renderFile(path.join(__dirname, '../mails/activation-mail.ejs'), data);

    try {
        await sendMail({
            email: user.email,
            subject: 'Activate your account',
            template: 'activation-mail.ejs',
            data
        });

        res.status(201).json({
            success: true,
            message: `Please check your email: ${user.email} to activate your account!`,
            activationToken: activationToken.token
        });
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});

export const createActivationToken = (user: any): IActivationToken => {
    const activationCode = Math.floor(1000 + Math.random() * 9000).toString();

    const token = jwt.sign({ user, activationCode }, process.env.ACTIVATION_SECRET as Secret, { expiresIn: '5m' });

    return { token, activationCode };
};

export const activateUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { activation_token, activation_code } = req.body as IActivationRequest;

    const newUser: { user: UserT; activationCode: string } = jwt.verify(
        activation_token,
        process.env.ACTIVATION_SECRET as string
    ) as { user: UserT; activationCode: string };

    if (newUser.activationCode !== activation_code) {
        return next(new ErrorHandler('Invalid activation code', 400));
    }

    const { name, email, password } = newUser.user;

    const isEmailExist = await UserModel.findOne({ email });
    if (isEmailExist) return next(new ErrorHandler('Email already exist', 400));

    await UserModel.create({
        name,
        email,
        password
    });

    res.status(201).json({
        success: true
    });
});

export const loginUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body as ILoginRequest;

    if (!email || !password) {
        return next(new ErrorHandler('Please enter email and password', 400));
    }

    const user = await UserModel.findOne({ email }).select('+password');

    if (!user) {
        return next(new ErrorHandler('Invalid email or password', 400));
    }

    const isPasswordMath = await user.comparePassword(password);

    if (!isPasswordMath) {
        return next(new ErrorHandler('Invalid email or password', 400));
    }

    sendToken(user, 200, res);
});

export const logoutUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    res.cookie('access_token', '', {
        domain: '.vercel.app',
        secure: true,
        sameSite: 'none',
        httpOnly: true,
        maxAge: 1
    });
    res.cookie('refresh_token', '', {
        domain: '.vercel.app',
        secure: true,
        sameSite: 'none',
        httpOnly: true,
        maxAge: 1
    });

    const userId = req.user?._id || '';
    if (userId) {
        redis.del(userId as RedisKey);
    }

    res.status(200).json({
        success: true,
        message: 'Logged out successfully'
    });
});

export const updateAccessToken = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const refresh_token = req.cookies.refresh_token as string;
    console.log(refresh_token);
    const decoded = jwt.verify(refresh_token, process.env.REFRESH_TOKEN as string) as JwtPayload;

    const message = 'Could not refresh token';

    if (!decoded) {
        return next(new ErrorHandler(message, 400));
    }

    const session = await redis.get(decoded.id as string);

    if (!session) {
        return next(new ErrorHandler(message, 400));
    }

    const user = JSON.parse(session);

    const accessToken = jwt.sign({ id: user._id }, process.env.ACCESS_TOKEN as string, {
        expiresIn: '1m'
    });
    const refreshToken = jwt.sign({ id: user._id }, process.env.REFRESH_TOKEN as string, {
        expiresIn: '3d'
    });

    req.user = user;
    req.access_token = accessToken;

    res.cookie('access_token', accessToken, accessTokenOptions);
    res.cookie('refresh_token', refreshToken, refreshTokenOptions);

    next();
});
// export const updateAccessToken = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
//     console.log('--- updateAccessToken Middleware Start ---');
//     console.log('Cookies received by Express:', req.cookies); // Log ALL cookies

//     try {
//         const accessToken = req.cookies.access_token;
//         const refreshToken = req.cookies.refresh_token;

//         console.log('accessToken:', accessToken);
//         console.log('refreshToken:', refreshToken);

//         // 1. Check Access Token (Optional, but good for debugging)
//         if (accessToken) {
//             try {
//                 const decodedAccessToken = jwt.verify(accessToken, process.env.ACCESS_TOKEN!) as { id: string };
//                 console.log('Decoded Access Token:', decodedAccessToken);
//                 // If access token is valid, you *could* just proceed.
//                 // However, for consistent refresh logic, it's common to *always* refresh.
//                 // req.user = decodedAccessToken; // You might set req.user here
//                 // return next(); // You could return early here
//             } catch (accessError) {
//                 console.error('Access Token Verification Error:', accessError);
//                 // Access token is invalid or expired.  Proceed to refresh logic.
//             }
//         }

//         // 2. Refresh Token Verification (Required)
//         if (!refreshToken) {
//             console.log('No refresh token provided.');
//             console.log('--- updateAccessToken Middleware End (No Refresh Token) ---');
//             return res.status(400).json({ message: 'No refresh token provided' }); // 400 Bad Request
//         }

//         let decodedRefreshToken;
//         try {
//             decodedRefreshToken = jwt.verify(refreshToken, process.env.REFRESH_TOKEN!) as { id: string };
//             console.log('Decoded Refresh Token:', decodedRefreshToken);
//         } catch (refreshError) {
//             console.error('Refresh Token Verification Error:', refreshError);
//             console.log('--- updateAccessToken Middleware End (Invalid Refresh Token) ---');
//             return res.status(401).json({ message: 'Invalid refresh token' }); // 401 Unauthorized
//         }

//         // 3. Redis Check (If you are using Redis)
//         if (redis) {
//             // Check if redisClient is defined
//             try {
//                 const session = await redis.get(`user:${decodedRefreshToken.id}`);
//                 console.log('Redis Session Data:', session);

//                 if (!session) {
//                     console.log('No session found in Redis.');
//                     console.log('--- updateAccessToken Middleware End (No Session) ---');
//                     return res.status(401).json({ message: 'Session expired' }); // Or a 400, depending on your preference
//                 }

//                 // Optionally, parse the session data if it's stored as JSON
//                 // const userData = JSON.parse(session) as IUser;
//                 // req.user = userData;
//             } catch (redisError) {
//                 console.error('Redis Error:', redisError);
//                 console.log('--- updateAccessToken Middleware End (Redis Error) ---');
//                 return res.status(500).json({ message: 'Internal server error (Redis)' });
//             }
//         } else {
//             console.log('Redis client is not initialized.'); // Add this log
//             // Handle the case where Redis is not being used.  You might have a fallback mechanism.
//         }
//         // 4. Generate New Access Token (If refresh token is valid and session exists)
//         const newAccessToken = jwt.sign({ id: decodedRefreshToken.id }, process.env.ACCESS_TOKEN!, { expiresIn: '1m' }); // Keep it short!
//         console.log('New Access Token Generated:', newAccessToken);

//         // 5. Set New Access Token Cookie
//         res.cookie('access_token', newAccessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });

//         // 6. Attach User to Request (Optional, but common)
//         // If you have user data, you can attach it to the request object.
//         // req.user = { id: decodedRefreshToken.id }; // Or the full user object from Redis/DB

//         console.log('--- updateAccessToken Middleware End (Success) ---');
//         next();
//     } catch (error) {
//         console.error('Unexpected Error in updateAccessToken:', error);
//         console.log('--- updateAccessToken Middleware End (Unexpected Error) ---');
//         return res.status(500).json({ message: 'Internal server error' });
//     }
// });

export const refreshToken = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const refresh_token = req.cookies.refresh_token as string;
    const decoded = jwt.verify(refresh_token, process.env.REFRESH_TOKEN as string) as JwtPayload;

    const message = 'Could not refresh token';

    if (!decoded) {
        return next(new ErrorHandler(message, 400));
    }

    const session = await redis.get(decoded.id as string);

    if (!session) {
        return next(new ErrorHandler(message, 400));
    }

    const user = JSON.parse(session);

    const accessToken = jwt.sign({ id: user._id }, process.env.ACCESS_TOKEN as string, {
        expiresIn: '1m'
    });
    const refreshToken = jwt.sign({ id: user._id }, process.env.REFRESH_TOKEN as string, {
        expiresIn: '3d'
    });

    req.user = user;
    req.access_token = accessToken;

    res.cookie('access_token', accessToken, accessTokenOptions);
    res.cookie('refresh_token', refreshToken, refreshTokenOptions);

    res.status(200).json({
        success: true,
        accessToken
    });
});

export const getUserInfo = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.user._id) {
        return next(new ErrorHandler('User not authenticated', 500));
    }

    const userId = req.user._id;
    getUserById(userId, res);
});

export const socialAuth = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { email, name, avatar } = req.body as ISocialAuthBody;
    const user = await UserModel.findOne({ email });
    if (!user) {
        const newUser = await UserModel.create({ email, name, avatar });
        sendToken(newUser, 200, res);
    } else {
        sendToken(user, 200, res);
    }
});

export const updateUserInfo = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { name, avatar, email, introduce, profession, age, phoneNumber, address } = req.body as IUpdateUserInfo;
    const userId = req.user?._id as RedisKey;
    const user = await UserModel.findById(userId);

    if (!user) {
        return next(new ErrorHandler('User not found', 404));
    }

    // Kiểm tra và cập nhật email (nếu email mới không trùng)
    if (email && email !== user.email) {
        const isEmailExist = await UserModel.findOne({ email });
        if (isEmailExist) {
            return next(new ErrorHandler('Email already exists', 400));
        }
        user.email = email;
    }

    // Cập nhật các trường khác
    if (name) user.name = name;
    if (introduce) user.introduce = introduce;
    if (profession) user.profession = profession;
    if (age) user.age = age;
    if (phoneNumber) user.phoneNumber = phoneNumber;
    if (address) user.address = address;

    // Cập nhật avatar nếu có
    if (avatar) {
        if (user.avatar?.public_id) {
            await cloudinary.v2.uploader.destroy(user.avatar.public_id);
        }

        const myCloud = await cloudinary.v2.uploader.upload(avatar, {
            folder: 'avatars',
            width: 150
        });

        user.avatar = {
            public_id: myCloud.public_id,
            url: myCloud.secure_url
        };
    }

    await user.save();
    await redis.set(userId, JSON.stringify(user));

    res.status(200).json({
        success: true,
        user
    });
});

export const updatePassword = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { oldPassword, newPassword } = req.body as IUpdatePassword;

    if (!oldPassword || !newPassword) {
        return next(new ErrorHandler('Please enter old password and new password', 400));
    }

    const user = await UserModel.findById(req.user?._id).select('+password');

    if (user?.password === undefined) {
        return next(new ErrorHandler('Invalid user', 400));
    }

    const isPasswordMatch = await user?.comparePassword(oldPassword);

    if (!isPasswordMatch) {
        return next(new ErrorHandler('Invalid old password', 400));
    }

    user.password = newPassword;
    await user.save();

    redis.set(req.user?._id as RedisKey, JSON.stringify(user));

    res.status(200).json({
        success: true,
        user
    });
});

export const updateProfilePicture = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { avatar } = req.body as IProfilePicture;

    const userId = req.user?._id;

    const user = await UserModel.findById(userId);

    if (user && avatar) {
        // If user already have avatar
        if (user?.avatar?.public_id) {
            await cloudinary.v2.uploader.destroy(user?.avatar?.public_id);
        }

        const myCloud = await cloudinary.v2.uploader.upload(avatar, {
            folder: 'avatars',
            width: 150
        });
        user.avatar = {
            public_id: myCloud.public_id,
            url: myCloud.secure_url
        };
    }

    await user?.save();

    await redis.set(userId as RedisKey, JSON.stringify(user));

    res.status(200).json({
        success: true,
        user
    });
});

// get all users -- for admin
export const getAllUsers = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    getAllUsersService(res);
});

// update user role -- for admin
export const updateUserRole = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id, role } = req.body;

    updateUserRoleService(res, id, role);
});

// delete user -- for admin
export const deleteUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const user = await UserModel.findById(id);

    if (!user) {
        return next(new ErrorHandler('User not found', 404));
    }

    await user.deleteOne({ id });

    await redis.del(id);

    res.status(200).json({
        success: true,
        message: 'User deleted successfully'
    });
});

export const forgotPasswordUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { email } = req.body;

    const user = await UserModel.findOne({ email });
    if (!user) return next(new ErrorHandler('User not found', 404));

    const resetToken = createActivationToken(user);

    const resetCode = resetToken.activationCode;

    const data = { user: { name: user.name }, resetCode };
    await ejs.renderFile(path.join(__dirname, '../mails/reset-password-mail.ejs'), data);

    try {
        await sendMail({
            email: user.email,
            subject: 'Reset your password',
            template: 'reset-password-mail.ejs',
            data
        });

        res.status(200).json({
            success: true,
            message: `Please check your email: ${user.email} to reset your password!`,
            resetToken: resetToken.token
        });
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
});

export const resetCodeVerify = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { reset_token, reset_code } = req.body as IResetCode;

    const decoded: { user: UserT; activationCode: string } = jwt.verify(
        reset_token,
        process.env.ACTIVATION_SECRET as string
    ) as { user: UserT; activationCode: string };

    if (decoded.activationCode !== reset_code) {
        return next(new ErrorHandler('Invalid reset code', 400));
    }

    res.status(201).json({
        success: true
    });
});

export const resetPassword = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { reset_token, newPassword } = req.body;

    if (!reset_token || !newPassword) {
        return next(new ErrorHandler('Missing reset token or new password', 400));
    }

    let decoded;
    try {
        decoded = jwt.verify(reset_token, process.env.ACTIVATION_SECRET as string) as { user: { email: string } };
    } catch (error) {
        return next(new ErrorHandler('Invalid or expired reset token', 400));
    }

    const user = await UserModel.findOne({ email: decoded?.user?.email });
    if (!user) {
        return next(new ErrorHandler('User not found', 404));
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({
        success: true,
        message: 'Password has been reset successfully'
    });
});

export const getTopInstructors = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const topInstructors = await UserModel.aggregate([
        { $match: { role: 'instructor' } },
        {
            $lookup: {
                from: 'courses',
                localField: 'uploadedCourses',
                foreignField: '_id',
                as: 'uploadedCoursesData'
            }
        },
        {
            $addFields: {
                totalStudents: {
                    $sum: {
                        $map: {
                            input: '$uploadedCoursesData',
                            as: 'course',
                            in: { $ifNull: ['$$course.purchased', 0] }
                        }
                    }
                },
                averageRating: {
                    $avg: {
                        $map: {
                            input: '$uploadedCoursesData',
                            as: 'course',
                            in: { $ifNull: ['$$course.rating', 0] }
                        }
                    }
                },
                uploadedCoursesCount: { $size: '$uploadedCoursesData' }
            }
        },
        { $sort: { totalStudents: -1, averageRating: -1 } },
        { $limit: 10 },
        {
            $project: {
                _id: 1,
                name: 1,
                email: 1,
                role: 1,
                avatar: 1,
                uploadedCourses: 1,
                totalStudents: 1,
                averageRating: 1,
                uploadedCoursesCount: 1,
                createdAt: 1,
                updatedAt: 1
            }
        }
    ]);

    if (!topInstructors || topInstructors.length === 0) {
        return next(new ErrorHandler('No instructors found', 404));
    }

    res.status(200).json({
        success: true,
        topInstructors
    });
});
export const getAllInstructors = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    getAllInstructorsService(res);
});

export const getInstructorsWithSort = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { type } = req.query;

    if (!type || (type !== 'recent' && type !== 'oldest')) {
        return next(new ErrorHandler('Invalid type parameter. Use "recent" or "oldest".', 400));
    }

    let users;

    if (type === 'recent') {
        const threeDaysAgo = new Date();
        threeDaysAgo.setUTCDate(threeDaysAgo.getUTCDate() - 3);

        users = await UserModel.find({ createdAt: { $gte: threeDaysAgo }, role: 'instructor' })
            .sort({ createdAt: -1 })
            .limit(3);
    } else {
        users = await UserModel.find({ role: 'instructor' })
            .sort({ createdAt: 1 }) // Sắp xếp tăng dần
            .limit(10);
    }

    res.status(200).json({
        success: true,
        instructors: users
    });
});
