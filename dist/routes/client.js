"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
const client_1 = require("../services/client");
const auth_1 = __importDefault(require("../middleware/auth"));
const multerConfig_1 = require("../middleware/multerConfig");
const upload_1 = require("../utils/upload");
const authenticate = auth_1.default.authenticate;
router
    // .post("/dashboard", authenticate, (req: AuthRequest, res: Response, next: NextFunction) => client_service.dashboard_stats(req, res, next))
    // .post("/history", authenticate, (req: AuthRequest, res: Response, next: NextFunction) => client_service.call_history(req, res, next))
    .post("/upload-csv", 
// authenticate,
multerConfig_1.upload.single("csvFile"), (req, res, next) => client_1.client_service.upload_csv(req, res, next))
    .post("/graph", authenticate, (req, res, next) => client_1.client_service.graph_chart(req, res, next))
    .get("/all-campaigns", authenticate, (req, res, next) => client_1.client_service.all_campaigns(req, res, next))
    .get("/campaign", authenticate, (req, res, next) => client_1.client_service.single_campaign(req, res, next))
    .post("/campaign-statistics", authenticate, (req, res, next) => client_1.client_service.single_campaign_stats(req, res, next))
    .get("/campaign-analytics", authenticate, (req, res, next) => client_1.client_service.single_campaign_analytics(req, res, next))
    .get("/all-campaign-analytics", authenticate, (req, res, next) => client_1.client_service.all_campaign_analytics(req, res, next))
    .get("/lead-msg-history", authenticate, (req, res, next) => client_1.client_service.fetch_message_history(req, res, next))
    .post("/forward-email", authenticate, (req, res, next) => client_1.client_service.forward_email(req, res, next))
    .get("/list-leads", authenticate, (req, res, next) => client_1.client_service.list_leads(req, res, next))
    .post("/reply-lead", authenticate, (req, res, next) => client_1.client_service.reply_lead(req, res, next))
    .post("/campaign-dashboard", authenticate, (req, res, next) => client_1.client_service.campaign_dashboard(req, res, next))
    .get("/campaign-overview", authenticate, (req, res, next) => client_1.client_service.campaign_overview(req, res, next))
    .post("/add-webhook", authenticate, (req, res, next) => client_1.client_service.add_webhook(req, res, next))
    .get("/email-sent/webhook", authenticate, (req, res, next) => client_1.client_service.email_sent_webhook(req, res, next))
    .post("/agent", authenticate, (req, res, next) => client_1.client_service.fetch_agent_data(req, res, next))
    .get("/schedule-details", authenticate, (req, res, next) => client_1.client_service.schedule_details(req, res, next))
    .post("/email-reply/webhook", (req, res) => client_1.client_service.email_reply_webhook(req, res))
    // .post("/lead-replies", authenticate, (req: AuthRequest, res: Response, next: NextFunction) => client_service.fetch_replies(req, res, next))
    .post("/agent-update", authenticate, (req, res, next) => client_1.client_service.update_agent(req, res, next))
    .get("/minutes-used", authenticate, (req, res, next) => client_1.client_service.minutes_used(req, res, next))
    .get("/trigger-lead-calls", authenticate, (req, res, next) => client_1.client_service.trigger_lead_calls(req, res, next))
    .post("/sentiment-transcript", authenticate, (req, res, next) => client_1.client_service.sentiment_correction_script(req, res, next))
    // .put(
    //     "/edit-profile", 
    //     authenticate,
    //     load.single("svgFile"),
    //     (req: AuthRequest, res: Response, next: NextFunction) => client_service.edit_profile(req, res, next))
    .put("/upload-svg", authenticate, upload_1.upload.single("svgFile"), (req, res, next) => client_1.client_service.upload_svg(req, res, next))
    .post("/add-notes", authenticate, (req, res, next) => client_1.client_service.add_notes(req, res, next))
    // .post("/voice-kpi", authenticate, (req: AuthRequest, res: Response, next: NextFunction) => client_service.voice_kpi(req, res, next))
    .post("/export-kpi", authenticate, (req, res, next) => client_1.client_service.export_kpi(req, res, next));
// .get("/details", authenticate, (req: AuthRequest, res: Response, next: NextFunction) => client_service.client_details(req, res, next))
exports.default = router;
