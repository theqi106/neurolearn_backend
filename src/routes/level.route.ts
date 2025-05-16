import express from 'express';
import { isAuthenticated } from '../middlewares/auth/isAuthenticated';
import { createLevel, getLevels } from '../controllers/level.controller';

const router = express.Router();

router.post('/', isAuthenticated, createLevel);

router.get('/', getLevels);

export = router;
