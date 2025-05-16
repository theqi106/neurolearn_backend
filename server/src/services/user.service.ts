import UserModel from '../models/User.model';
import { redis } from '../utils/redis';
import { Response } from 'express';

export const getUserById = async (id: string, res: Response) => {
    const userJSON = await redis.get(id);

    if (userJSON) {
        const user = JSON.parse(userJSON);
        res.status(200).json({
            success: true,
            user
        });
    }
};

export const getAllUsersService = async (res: Response) => {
    const users = await UserModel.find().sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        users
    });
};

export const updateUserRoleService = async (res: Response, id: string, role: string) => {
    const user = await UserModel.findByIdAndUpdate(id, { role }, { new: true });
    await redis.set(id, JSON.stringify(user));
    res.status(200).json({
        success: true,
        user
    });
};

export const getAllInstructorsService = async (res: Response) => {
    const instructors = await UserModel.find({ role: 'instructor' }).sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        instructors
    });
};
