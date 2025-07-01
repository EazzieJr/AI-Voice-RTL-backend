"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
const user_1 = require("../services/user");
router
    .post("/signup", (req, res, next) => {
    user_1.user_service.signup_client(req, res, next);
});
exports.default = router;
