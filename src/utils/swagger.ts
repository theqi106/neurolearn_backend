import swaggerJsdoc from 'swagger-jsdoc';
import dotenv from 'dotenv';

dotenv.config();

const serverUrl = process.env.NODE_ENV === 'production' ? process.env.SERVER_URL : 'http://localhost:8000';
const isProduction = process.env.NODE_ENV === 'production';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'NeuroLearn API Documentation',
            version: '1.0.0',
            description: 'API documentation for NeuroLearn backend'
        },
        servers: [
            {
                url: serverUrl,
                description: isProduction ? 'Production server' : 'Development server'
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT'
                }
            }
        },
        security: [
            {
                bearerAuth: []
            }
        ]
    },
    apis: ['./src/routes/*.ts', './src/models/*.ts']
};

export const swaggerSpec = swaggerJsdoc(options);
