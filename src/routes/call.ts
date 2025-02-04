import express, { Request, Response, NextFunction } from "express";
import { call_service } from "../services/call";
import { AuthRequest } from "../middleware/authRequest";

const router = express.Router();

router
    .post("/webhook", (req: Request, res: Response, next: NextFunction) => {
        call_service.retell_webhook(req, res, next);
    })

    .post("/schedule", (req: Request, res: Response, next: NextFunction) => {
        call_service.schedule_call(req, res, next);
    })

    .post("/cancel-schedule", (req: AuthRequest, res: Response, next: NextFunction) => {
        call_service.cancel_schedule(req, res, next);
    })

export default router;