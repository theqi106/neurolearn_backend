import { NextFunction, Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import ErrorHandler from '../utils/ErrorHandler';
import LevelModel from '../models/Level.model';

export const createLevel = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { name } = req.body;

    if (!name) {
        return next(new ErrorHandler('Please provide a level', 400));
    }

    const level = await LevelModel.create({
        name
    });

    res.status(201).json({
        success: true,
        level
    });
});

export const getLevels = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const levels = await LevelModel.find();
    res.status(200).json({
        success: true,
        levels
    });
});
