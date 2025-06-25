"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const userModel_1 = require("../models/userModel");
// import { Document, Model } from 'mongoose';
// type UserDocument = Document<unknown, {}, typeof userModel.schema.obj>;
// interface AuthRequest extends Request {
//     user?: UserDocument
// };
class AuthMiddleware {
    constructor() {
        this.authenticate = async (request, _, next) => {
            try {
                const { authorization } = request.headers;
                if (!authorization) {
                    return next({
                        status_code: 403,
                        error: "Unauthorized: Authorization header not found"
                    });
                }
                ;
                const [, apiKey] = authorization.split(" ");
                if (!apiKey) {
                    return next({
                        status_code: 403,
                        error: "Unauthorized: Auth token not found"
                    });
                }
                ;
                try {
                    const user_details = jsonwebtoken_1.default.verify(apiKey, process.env.JWT_SECRET);
                    request.user = await userModel_1.userModel.findById(user_details.userId).select("-password");
                    if (request.user) {
                        return next();
                    }
                    ;
                    return next({
                        status_code: 403,
                        error: "Unauthorized: Invalid auth token"
                    });
                }
                catch (e) {
                    console.error({ e });
                    return next({ error: "Unauthorized: Error decoding auth token" });
                }
            }
            catch (e) {
                console.error({ e });
                return next({ error: "Unauthorized" });
            }
            ;
        };
    }
    ;
}
;
exports.default = new AuthMiddleware();
