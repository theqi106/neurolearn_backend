import express, { RequestHandler } from 'express';
import {
    activateUser,
    deleteUser,
    getAllInstructors,
    getAllUsers,
    getInstructorsWithSort,
    getUserInfo,
    loginUser,
    logoutUser,
    registrationUser,
    socialAuth,
    updateAccessToken,
    updatePassword,
    updateProfilePicture,
    updateUserInfo,
    updateUserRole,
    forgotPasswordUser,
    resetCodeVerify,
    resetPassword,
    refreshToken,
    updateUserSocialLinks,
    getUser,
    getTopInstructors
} from '../controllers/user.controller';
import { isAuthenticated } from '../middlewares/auth/isAuthenticated';
import { authorizeRoles } from '../middlewares/auth/authorizeRoles';

const router = express.Router();

router.post('/register', registrationUser);

router.post('/activate-user', activateUser);

router.post('/login', loginUser);

router.post('/forgot-password', forgotPasswordUser);

router.post('/resetcode-verify', resetCodeVerify);

router.put('/reset-password', resetPassword);

router.get('/logout', isAuthenticated, authorizeRoles('user', 'instructor'), logoutUser);

router.get('/refresh', refreshToken);

router.get('/me', updateAccessToken, isAuthenticated, getUserInfo);

router.post('/social-auth', socialAuth);

router.put('/update-user', updateAccessToken, isAuthenticated, updateUserInfo);

router.put('/update-password', updateAccessToken, isAuthenticated, updatePassword);

router.put('/update-avatar', updateAccessToken, isAuthenticated, updateProfilePicture);

router.put('/update-link', updateAccessToken, isAuthenticated, updateUserSocialLinks);

router.get('/get-users', isAuthenticated, authorizeRoles('admin'), getAllUsers);

router.get('/top-instructors', getTopInstructors);

router.get('/get-instructors', getAllInstructors);

router.get('/:id', getUser);

router.get('/instructors/sort', getInstructorsWithSort as RequestHandler);

router.put('/update-role', isAuthenticated, authorizeRoles('admin'), updateUserRole);

router.delete('/delete-user:id', isAuthenticated, authorizeRoles('admin'), deleteUser);

export = router;
