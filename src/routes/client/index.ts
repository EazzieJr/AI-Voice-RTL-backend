import app from "express";
const router = app.Router();

import email_campaign_route from "./email_campaign.route";
import voice_data_route from "./voice_data.route";
import profile_management_route from "./profile.route";
import webhook_route from "./webhook.route";

router.use("/", email_campaign_route);
router.use("/", voice_data_route);
router.use("/", profile_management_route);
router.use("/", webhook_route);

export default router;