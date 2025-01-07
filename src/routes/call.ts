import express, { Request, Response, NextFunction } from "express";
import { call_service } from "../services/call";

const router = express.Router();

router
    .post("/webhook", (req: Request, res: Response, next: NextFunction) => {
        call_service.retell_webhook(req, res, next);
    })

export default router;