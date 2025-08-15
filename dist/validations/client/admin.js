"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeleteListSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.DeleteListSchema = joi_1.default.object({
    tag: joi_1.default.string().required(),
});
