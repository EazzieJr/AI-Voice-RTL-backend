import app from "express";
const router = app.Router();

import email_campaign_route from "./email_campaign.route";

router.use("/", email_campaign_route);

export default router;