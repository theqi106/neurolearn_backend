import { NextFunction, Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import ErrorHandler from '../utils/ErrorHandler';
import CategoryModel from '../models/Category.model';
import SubCategoryModel from '../models/SubCategory.model';

export const createCategory = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { title } = req.body;

    if (!title) {
        return next(new ErrorHandler('Please provide a category title', 400));
    }

    const category = await CategoryModel.create({
        title
    });

    res.status(201).json({
        success: true,
        category
    });
});

export const createSubCategory = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { title } = req.body;
    const { id } = req.params;

    const category = await CategoryModel.findById(id);

    if (!category) {
        return next(new ErrorHandler('Category not found', 404));
    }

    if (!title) {
        return next(new ErrorHandler('Please provide a sub-category title', 400));
    }

    const subCategory = await SubCategoryModel.create({
        title,
        categoryId: id
    });

    res.status(201).json({
        success: true,
        subCategory
    });
});

export const getCategories = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const categories = await CategoryModel.find();
    res.status(200).json({
        success: true,
        categories
    });
});

export const getSubCategoriesByCategoryId = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const category = await CategoryModel.findById(id);

    if (!category) {
        return next(new ErrorHandler('Category not found', 404));
    }

    const subCategories = await SubCategoryModel.find({ categoryId: id }).populate('categoryId');

    res.status(200).json({
        success: true,
        subCategories
    });
});

export const getCategory = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const category = await CategoryModel.findById(id);

    res.status(200).json({
        success: true,
        category
    });
});
export const getAllCategoriesWithSubcategories = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const categories = await CategoryModel.find();

    const subCategories = await SubCategoryModel.find().populate('categoryId');

    const result = categories.map((category) => {
        return {
            ...category.toObject(),
            subCategories: subCategories
                .filter((subCat) => subCat.categoryId._id.toString() === category._id.toString())
                .map((subCat) => ({
                    _id: subCat._id,
                    title: subCat.title
                }))
        };
    });
    res.status(200).json({
        success: true,
        categories: result
    });
});
