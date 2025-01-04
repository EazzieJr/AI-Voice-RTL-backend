import { Request } from "express";
import { userModel } from '../models/userModel';
import { Document } from 'mongoose';

type UserDocument = Document<unknown, {}, typeof userModel.schema.obj>;

export interface AuthRequest extends Request {
    user?: UserDocument
};
