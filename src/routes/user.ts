import express, { Request, Response, NextFunction } from "express";
const router = express.Router();
import { user_service } from "../services/user";

router
    .post("/signup", (req: Request, res: Response, next: NextFunction) => {
        user_service.signup_client(req, res, next);
    })

export default router;