import express, { Response, NextFunction } from "express";
import { profile_management_service } from "../../services/client/profile";
import { AuthRequest } from "../../middleware/authRequest";
import AuthMiddleware from "../../middleware/auth";

const authenticate = AuthMiddleware.authenticate;

const router = express.Router();

router

export default router;