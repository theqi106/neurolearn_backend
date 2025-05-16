import { BannerImage, Category, FaqItem, Layout } from '../interfaces/Layout';
import mongoose, { Schema } from 'mongoose';

const FaqSchema = new Schema<FaqItem>({
    question: String,
    answer: String
});

const CategorySchema = new Schema<Category>({
    title: String
});

const BannerImageSchema = new Schema<BannerImage>({
    public_id: String,
    url: String
});

const LayoutSchema = new Schema<Layout>({
    type: String,
    faq: [FaqSchema],
    categories: [CategorySchema],
    banner: {
        image: BannerImageSchema,
        title: String,
        subTitle: String
    }
});

export default mongoose.models.Layout || mongoose.model<Layout>('Layout', LayoutSchema);
