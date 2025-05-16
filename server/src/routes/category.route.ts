import express from 'express';
import { isAuthenticated } from '../middlewares/auth/isAuthenticated';
import {
    createCategory,
    createSubCategory,
    getAllCategoriesWithSubcategories,
    getCategories,
    getCategory,
    getSubCategoriesByCategoryId
} from '../controllers/category.controller';

const router = express.Router();

router.post('/', isAuthenticated, createCategory);

router.post('/sub-category/:id', isAuthenticated, createSubCategory);

router.get('/', getCategories);

router.get('/all', getAllCategoriesWithSubcategories);

router.get('/:id', getCategory);

router.get('/sub-category/:id', getSubCategoriesByCategoryId);

export = router;
