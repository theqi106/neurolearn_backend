import express from 'express';
import { isAuthenticated } from '../middlewares/auth/isAuthenticated';
import { getAllNotificationsByInstructor, updateNotificationStatus } from '../controllers/notification.controller';

const router = express.Router();

router.get('/', isAuthenticated, getAllNotificationsByInstructor);

router.put('/:id', isAuthenticated, updateNotificationStatus);

export = router;
