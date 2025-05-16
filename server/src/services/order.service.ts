import OrderModel from '../models/Order.model';
import { NextFunction, Response } from 'express';

export const newOrder = async (data: any, next: NextFunction, res: Response) => {
    const order = await OrderModel.create(data);
    res.status(201).json({
        success: true,
        order
    });
};

export const getAllOrdersService = async (res: Response) => {
    const orders = await OrderModel.find().sort({ createdAt: -1 });
    res.status(200).json({
        success: true,
        orders
    });
};
