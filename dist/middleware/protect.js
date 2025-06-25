"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const userModel_1 = require("../models/userModel");
const authmiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer")) {
            return res.status(400).json({ message: "Authentication token required" });
        }
        const token = authHeader.split(" ")[1];
        try {
            const decodedToken = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            if (!decodedToken) {
                return res.status(400).json({ message: "Invalid token" });
            }
            req.user = await userModel_1.userModel
                .findById(decodedToken.userId)
                .select("-password");
            next();
        }
        catch (error) {
            console.log(error);
            return res.status(400).json({ message: "Auth failed" });
        }
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Failed to authenticate token" });
    }
};
exports.default = authmiddleware;
