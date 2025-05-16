import cloudinary from 'cloudinary';
import { catchAsync } from '../utils/catchAsync';
import { NextFunction, Request, Response } from 'express';
import LayoutModel from '../models/Layout.model';
import ErrorHandler from '../utils/ErrorHandler';

// create layout
export const createLayout = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { type } = req.body;

    const isTypeExist = await LayoutModel.findOne({ type });
    if (isTypeExist) {
        return next(new ErrorHandler(`${type} already exist`, 400));
    }

    if (type === 'Banner') {
        const { image, title, subtitle } = req.body;
        const myCloud = await cloudinary.v2.uploader.upload(image, {
            folder: 'layout'
        });
        const banner = {
            image: {
                public_id: myCloud.public_id,
                url: myCloud.secure_url
            },
            title,
            subtitle
        };
        await LayoutModel.create(banner);
    }

    if (type === 'FAQ') {
        const { faq } = req.body;
        const faqItems = await Promise.all(
            faq.map(async (item: any) => {
                return {
                    question: item.question,
                    answer: item.answer
                };
            })
        );
        await LayoutModel.create({ type: 'FAQ', faq: faqItems });
    }

    if (type === 'Categories') {
        const { categories } = req.body;
        const categoryItems = await Promise.all(
            categories.map(async (item: any) => {
                return {
                    title: item.title
                };
            })
        );
        await LayoutModel.create({
            type: 'Categories',
            categories: categoryItems
        });
    }

    res.status(201).json({
        success: true,
        message: 'Layout was created successfully'
    });
});

// edit layout
export const editLayout = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { type } = req.body;

    const isTypeExist = await LayoutModel.findOne({ type });
    if (isTypeExist) {
        return next(new ErrorHandler(`${type} already exist`, 400));
    }

    if (type === 'Banner') {
        const bannerData: any = await LayoutModel.findOne({
            type: 'Banner'
        });
        const { image, title, subtitle } = req.body;
        if (bannerData) {
            await cloudinary.v2.uploader.destroy(bannerData.image.public_id);
        }
        const myCloud = await cloudinary.v2.uploader.upload(image, {
            folder: 'layout'
        });
        const banner = {
            image: {
                public_id: myCloud.public_id,
                url: myCloud.secure_url
            },
            title,
            subtitle
        };
        await LayoutModel.findByIdAndUpdate(bannerData._id, { banner });
    }

    if (type === 'FAQ') {
        const { faq } = req.body;
        const FaqItem: any = await LayoutModel.findOne({
            type: 'FAQ'
        });
        const faqItems = await Promise.all(
            faq.map(async (item: any) => {
                return {
                    question: item.question,
                    answer: item.answer
                };
            })
        );
        await LayoutModel.findByIdAndUpdate(FaqItem?._id, {
            type: 'FAQ',
            faq: faqItems
        });
    }

    if (type === 'Categories') {
        const { categories } = req.body;
        const categoriesData: any = await LayoutModel.findOne({
            type: 'Categories'
        });
        const categoryItems = await Promise.all(
            categories.map(async (item: any) => {
                return {
                    title: item.title
                };
            })
        );
        await LayoutModel.findByIdAndUpdate(categoriesData?._id, {
            type: 'Categories',
            categories: categoryItems
        });
    }

    res.status(201).json({
        success: true,
        message: 'Layout was updated successfully'
    });
});

// get layout by type
export const getLayoutByType = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { type } = req.body;
    const layout = await LayoutModel.findOne({ type });
    res.status(200).json({
        success: true,
        layout
    });
});
