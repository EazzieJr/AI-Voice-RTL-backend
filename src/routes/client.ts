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

    .get("/all-campaigns", authenticate, (req: AuthRequest, res: Response, next: NextFunction) => client_service.all_campaigns(req, res, next))

    .get("/campaign", authenticate, (req: AuthRequest, res: Response, next: NextFunction) => client_service.single_campaign(req, res, next))

    .post("/campaign-statistics", authenticate, (req: AuthRequest, res: Response, next: NextFunction) => client_service.single_campaign_stats(req, res, next))

    .get("/campaign-analytics", authenticate, (req: AuthRequest, res: Response, next: NextFunction) => client_service.single_campaign_analytics(req, res, next))

    .get("/all-campaign-analytics", authenticate, (req: AuthRequest, res: Response, next: NextFunction) => client_service.all_campaign_analytics(req, res, next))

    .get("/lead-msg-history", authenticate, (req: AuthRequest, res: Response, next: NextFunction) => client_service.fetch_message_history(req, res, next))

    .post("/forward-email", authenticate, (req: AuthRequest, res: Response, next: NextFunction) => client_service.forward_email(req, res, next))

    .get("/list-leads", authenticate, (req: AuthRequest, res: Response, next: NextFunction) => client_service.list_leads(req, res, next))

    .post("/reply-lead", authenticate, (req: AuthRequest, res: Response, next: NextFunction) => client_service.reply_lead(req, res, next))

    .get("/campaign-dashboard", authenticate, (req: AuthRequest, res: Response, next: NextFunction) => client_service.campaign_dashboard(req, res, next))

    .get("/campaign-overview", authenticate, (req: AuthRequest, res: Response, next: NextFunction) => client_service.campaign_overview(req, res, next))

    .post("/add-webhook", authenticate, (req: AuthRequest, res: Response, next: NextFunction) => client_service.add_webhook(req, res, next))

    .get("/email-sent/webhook", authenticate, (req: AuthRequest, res: Response, next: NextFunction) => client_service.email_sent_webhook(req, res, next))

    .post("/agent", authenticate, (req: AuthRequest, res: Response, next: NextFunction) => client_service.fetch_agent_data(req, res, next))

    .get("/schedule-details", authenticate, (req: AuthRequest, res: Response, next: NextFunction) => client_service.schedule_details(req, res, next))

export default router; 