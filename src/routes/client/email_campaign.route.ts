import express, { Request, Response, NextFunction } from "express";
import { email_campaign_service } from "../../services/client/email_campaign";
import { AuthRequest } from "../../middleware/authRequest";
import AuthMiddleware from "../../middleware/auth";

const authenticate = AuthMiddleware.authenticate;

const router = express.Router();

router
    .post("/email-reach-graph", authenticate, (req: AuthRequest, res: Response, next: NextFunction) => {
        email_campaign_service.email_reach_graph(req, res, next);
    });

export default router;