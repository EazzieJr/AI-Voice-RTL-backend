"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EditProfileSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.EditProfileSchema = joi_1.default.object({
    username: joi_1.default.string(),
    password: joi_1.default.string(),
    email: joi_1.default.string(),
    group: joi_1.default.string(),
    name: joi_1.default.string(),
    clientType: joi_1.default.string(),
    inbound: joi_1.default.string(),
    outbound: joi_1.default.string(),
    phone: joi_1.default.string(),
});
