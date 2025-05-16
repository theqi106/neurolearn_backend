import express from 'express';
import { getUserIncome } from '../controllers/income.controller';
import { isAuthenticated } from '../middlewares/auth/isAuthenticated';
import { authorizeRoles } from '../middlewares/auth/authorizeRoles';
import { updateAccessToken } from '../controllers/user.controller';

const router = express.Router();

router.get('/:userId', updateAccessToken, isAuthenticated, authorizeRoles('instructor'), getUserIncome);

export = router;
