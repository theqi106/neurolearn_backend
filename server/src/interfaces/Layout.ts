import { Document } from 'mongoose';

export interface FaqItem extends Document {
    question: string;
    answer: string;
}

export interface Category extends Document {
    title: string;
}

export interface BannerImage extends Document {
    public_id: string;
    url: string;
}

export interface Layout extends Document {
    type: string;
    faq: FaqItem[];
    categories: Category[];
    banner: {
        image: BannerImage;
        title: string;
        subTitle: string;
    };
}
