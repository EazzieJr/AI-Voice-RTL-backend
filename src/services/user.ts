import RootService from "./_root";
import { Request, Response, NextFunction } from "express";
import { userModel } from "../models/userModel";
import { SignUpSchema } from "../validations/user";
import jwt from "jsonwebtoken";
import * as dotenv from "dotenv";
dotenv.config();

class UserService extends RootService {
    async signup_client(request: Request, response: Response, next: NextFunction): Promise<Response> {
        try {
            const body = request.body;
            console.log("inside new logic");

            const { error } = SignUpSchema.validate(body, {
                abortEarly: false
            });
            if (error) {
                return this.handle_validation_errors(error, response, next);
            };

            const { email } = body;
            const existing_user = await userModel.findOne({ email });
            if (existing_user) {
                return response.status(400).json({
                    success: false,
                    message: "User already exists with this email"
                });
            };

            const new_user = await userModel.create({ ...body });

            if (!new_user._id) return response.status(400).json({
                success: false,
                message: "Failed to create user"
            });

            const token = jwt.sign(
                { userId: new_user._id, email: new_user.email },
                process.env.JWT_SECRET,
                { expiresIn: "30d" }
            );

            return response.status(201).json({
                payload: {
                    message: "User created successfully",
                    token
                }
            });

        } catch (error) {
            console.error("Error during signup:", error);
            next(error);
        };
    };
};

export const user_service = new UserService();