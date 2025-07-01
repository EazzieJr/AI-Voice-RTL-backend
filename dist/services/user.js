"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.user_service = void 0;
const _root_1 = __importDefault(require("./_root"));
const userModel_1 = require("../models/userModel");
const user_1 = require("../validations/user");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
class UserService extends _root_1.default {
    async signup_client(request, response, next) {
        try {
            const body = request.body;
            console.log("inside new logic");
            const { error } = user_1.SignUpSchema.validate(body, {
                abortEarly: false
            });
            if (error) {
                return this.handle_validation_errors(error, response, next);
            }
            ;
            const { email } = body;
            const existing_user = await userModel_1.userModel.findOne({ email });
            if (existing_user) {
                return response.status(400).json({
                    success: false,
                    message: "User already exists with this email"
                });
            }
            ;
            const new_user = await userModel_1.userModel.create(Object.assign({}, body));
            if (!new_user._id)
                return response.status(400).json({
                    success: false,
                    message: "Failed to create user"
                });
            const token = jsonwebtoken_1.default.sign({ userId: new_user._id, email: new_user.email }, process.env.JWT_SECRET, { expiresIn: "30d" });
            return response.status(201).json({
                payload: {
                    message: "User created successfully",
                    token
                }
            });
        }
        catch (error) {
            console.error("Error during signup:", error);
            next(error);
        }
        ;
    }
    ;
}
;
exports.user_service = new UserService();
