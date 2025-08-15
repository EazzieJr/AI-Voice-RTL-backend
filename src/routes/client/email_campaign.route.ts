import express, { Request, Response, NextFunction } from "express";
import { email_campaign_service } from "../../services/client/email_campaign";
import { AuthRequest } from "../../middleware/authRequest";
import AuthMiddleware from "../../middleware/auth";

const authenticate = AuthMiddleware.authenticate;

const router = express.Router();

router
    .post("/campaign-details-analytics", authenticate, (req: AuthRequest, res: Response, next: NextFunction) => email_campaign_service.campaign_details_analytics(req, res, next))

    .post("/lead-replies", authenticate, (req: AuthRequest, res: Response, next: NextFunction) => email_campaign_service.fetch_replies(req, res, next))

export default router;