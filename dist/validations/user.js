"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignUpSchema = exports.RequiredPassword = exports.RequiredEmail = void 0;
const joi_1 = __importDefault(require("joi"));
exports.RequiredEmail = {
    email: joi_1.default.string()
        .email()
        .required()
        .messages({
        "string.email": "Invalid email address",
        "any.required": "Email is required"
    })
};
exports.RequiredPassword = {
    password: joi_1.default.string().required()
};
exports.SignUpSchema = joi_1.default.object(Object.assign(Object.assign(Object.assign({}, exports.RequiredEmail), exports.RequiredPassword), { username: joi_1.default.string().required(), group: joi_1.default.string().required(), name: joi_1.default.string().required(), clientType: joi_1.default.string().valid("mixed", "voice", "email", "inbound").default("mixed") }));
