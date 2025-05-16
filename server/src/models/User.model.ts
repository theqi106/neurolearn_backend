import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserT } from '../interfaces/User';

export const UserSchema: Schema<UserT> = new Schema(
    {
        name: {
            type: String,
            required: [true, 'Please provide user name'],
            trim: true
        },
        email: {
            type: String,
            required: [true, 'Please provide email'],
            match: [
                /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
                'Please provide a valid email'
            ],
            unique: true,
            trim: true
        },
        password: {
            type: String,
            minlength: [6, 'Password must be more than 6 characters'],
            trim: true,
            select: false
        },
        confirmPassword: {
            type: String,
            // required: [true, 'Please confirm your password'],
            minlength: [6, 'Password must be more than 6 characters'],
            trim: true,
            validate: {
                validator: function (this: UserT, el: string): boolean {
                    // `this` only works correctly on save (not update queries)
                    return el === this.password;
                },
                message: 'Passwords do not match!'
            }
        },
        role: {
            type: String,
            trim: true,
            lowercase: true,
            enum: ['user', 'admin', 'instructor'],
            default: 'user'
        },
        avatar: {
            public_id: String,
            url: String
        },
        isVerified: {
            type: Boolean,
            default: false
        },
        purchasedCourses: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Course' // add relationship
            }
        ],
        uploadedCourses: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Course' // add relationship
            }
        ],
        introduce: {
            type: String,
            default: ''
        },
        profession: {
            type: String,
            trim: true,
            default: ''
        },
        phoneNumber: {
            type: String,
            trim: true,
            default: ''
        },
        address: {
            type: String,
            trim: true,
            default: ''
        },
        age: {
            type: Number,
            min: [0, 'Age must be a positive number'],
            default: null
        },
        rating: {
            type: Number,
            default: null
        },
        student: {
            type: Number,
            default: null
        },
        socialLinks: {
            facebook: { type: String, default: '' },
            twitter: { type: String, default: '' },
            linkedin: { type: String, default: '' },
            instagram: { type: String, default: '' }
        }
    },
    {
        timestamps: true,
        toJSON: {
            transform: (doc, ret) => {
                delete ret.__v; // Remove __v field
                return ret;
            }
        },
        toObject: {
            transform: (doc, ret) => {
                delete ret.__v; // Remove __v field
                return ret;
            }
        }
    }
);

// hash password before saving
UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// sign access token
UserSchema.methods.signAccessToken = function () {
    return jwt.sign({ id: this._id }, process.env.ACCESS_TOKEN || '', {
        expiresIn: '5m'
    });
};

// sign refresh token
UserSchema.methods.signRefreshToken = function () {
    return jwt.sign({ id: this._id }, process.env.REFRESH_TOKEN || '', {
        expiresIn: '3d'
    });
};

// compare the password
UserSchema.methods.comparePassword = async function (enteredPassword: string): Promise<boolean> {
    return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.models.User || mongoose.model<UserT>('User', UserSchema);
