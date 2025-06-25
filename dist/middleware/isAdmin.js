"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAdmin = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const isAdmin = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer")) {
            return res.status(400).json({ message: "Authentication token required" });
        }
        const token = authHeader.split(" ")[1];
        try {
            const decodedToken = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            if (!decodedToken) {
                return res.status(400).json({ message: "Invalid Authentication token" });
            }
            next();
        }
        catch (error) {
            console.log(error);
            return res.status(401).json({ message: "You are not Authenticated , Please login" });
        }
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: "Error while authenticating" });
    }
};
exports.isAdmin = isAdmin;
