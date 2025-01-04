import express, { Request, Response, NextFunction } from "express";
const router = express.Router();
import { client_service } from "../services/client";
import { AuthRequest } from "../middleware/authRequest";
import AuthMiddleware from "../middleware/auth";

const authenticate = AuthMiddleware.authenticate;

router
    .get("/dashboard", authenticate, (req: AuthRequest, res: Response, next: NextFunction) => client_service.dashboard_stats(req, res, next))

export default router; 