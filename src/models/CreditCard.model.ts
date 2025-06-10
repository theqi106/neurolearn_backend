import { Schema, model, Types } from 'mongoose';

interface ICreditCard {
  name: string;
  accountNumber: string;
  cardType: string;
  user: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const creditCardSchema = new Schema<ICreditCard>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    accountNumber: {
      type: String,
      required: [true, 'Account number is required'],
      unique: true,
      trim: true,
      index: true,
    },
    cardType: {
      type: String,
      required: [true, 'Card type is required'],
      trim: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
      unique: true, 
    },
  },
  {
    timestamps: true,
  }
);

const CreditCard = model<ICreditCard>('CreditCard', creditCardSchema);

export default CreditCard;
