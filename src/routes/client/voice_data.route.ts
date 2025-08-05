import express, { Request, Response, NextFunction } from "express";
import { voice_data_service } from "../../services/client/voice_data";
import { AuthRequest } from "../../middleware/authRequest";
import AuthMiddleware from "../../middleware/auth";

const authenticate = AuthMiddleware.authenticate;

const router = express.Router();

router
    .post("/voice-kpi", authenticate, (req: AuthRequest, res: Response, next: NextFunction) => voice_data_service.voice_kpi(req, res, next))

    .get("/schedule-history", authenticate, (req: AuthRequest, res: Response, next: NextFunction) => voice_data_service.schedule_history(req, res, next))

    .post("/dashboard", authenticate, (req: AuthRequest, res: Response, next: NextFunction) => voice_data_service.dashboard_stats(req, res, next))

    .post("/history", authenticate, (req: AuthRequest, res: Response, next: NextFunction) => voice_data_service.call_history(req, res, next))


export default router;