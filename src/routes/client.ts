import express, { Request, Response, NextFunction } from "express";
const router = express.Router();
import { client_service } from "../services/client";
import { AuthRequest } from "../middleware/authRequest";
import AuthMiddleware from "../middleware/auth";
import { upload } from "../middleware/multerConfig";

const authenticate = AuthMiddleware.authenticate;

router
    .post("/dashboard", authenticate, (req: AuthRequest, res: Response, next: NextFunction) => client_service.dashboard_stats(req, res, next))

    .post("/history", authenticate, (req: AuthRequest, res: Response, next: NextFunction) => client_service.call_history(req, res, next))

    .post("/upload-csv", 
        // authenticate,
        upload.single("csvFile"),
        (req: AuthRequest, res: Response, next: NextFunction) => client_service.upload_csv(req, res, next))

    .post("/graph", authenticate, (req: AuthRequest, res: Response, next: NextFunction) => client_service.graph_chart(req, res, next))

export default router; 