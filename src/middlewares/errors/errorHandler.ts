import { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import ErrorHandler from '../../utils/ErrorHandler';

export const errorHandlerMiddleware: ErrorRequestHandler = (
    error,
    req: Request,
    res: Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    next: NextFunction
) => {
    error.statusCode = error.statusCode || 500;
    error.message = error.message || 'Internal Server Error';

    // wrong mongodb id error
    if (error.name === 'CastError') {
        const message = `Resource not found. Invalid: ${error.path}`;
        error = new ErrorHandler(message, 400);
    }

    // Duplicate key error
    if (error.code === 11000) {
        const message = `Duplicate ${Object.keys(error.keyValue)} entered`;
        error = new ErrorHandler(message, 400);
    }

    // Wrong JWT error
    if (error.name === 'JsonWebTokenError') {
        const message = 'Json web token is invalid, try again';
        error = new ErrorHandler(message, 400);
    }

    // JWT expired error
    if (error.name === 'TokenExpiredError') {
        const message = 'Json web token is expired, try again';
        error = new ErrorHandler(message, 400);
    }

    res.status(error.statusCode).json({
        success: false,
        message: error.message
    });
};

export default errorHandlerMiddleware;
