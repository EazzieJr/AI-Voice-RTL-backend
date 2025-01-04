import express, { Request, Response, NextFunction } from "express";
const router = express.Router();
import { client_service } from "../services/client";
import authmiddleware from "../middleware/protect";

router
    .post("/dashboard", authmiddleware, (req: Request, res: Response, next: NextFunction) => client_service.dashboard_stats(req, res, next))
    
export default router;