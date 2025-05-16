import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';
import app from './app';
import { connectDB } from './utils/db';

dotenv.config();

// cloudinary config
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET
});

// Connecting to MongoDB and Starting Server
export const startServer = async () => {
    try {
        await connectDB(process.env.DB_URI);

        console.log('MongoDB database connection established successfully');

        app?.listen(process.env.PORT, () => {
            console.log(`Server is listening on port: http://localhost:${process.env.PORT} ....`);
        });
    } catch (error: any) {
        console.log('MongoDB connection error. Please make sure MongoDB is running: ');
    }
};

// Establish http server connection
startServer();

export default app;
