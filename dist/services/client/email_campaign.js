"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.email_campaign_service = void 0;
const _root_1 = __importDefault(require("../_root"));
const axios_1 = __importDefault(require("axios"));
const email_campaign_1 = require("../../validations/client/email_campaign");
const userModel_1 = require("../../models/userModel");
const dateQuery_1 = require("../../utils/dateQuery");
class EmailCampaignService extends _root_1.default {
    async email_reach_graph(req, res, next) {
        try {
            console.log("In here");
            const clientId = req.user._id;
            const body = req.body;
            const { error } = email_campaign_1.EmailReachSchema.validate(body, {
                abortEarly: false
            });
            if (error)
                return this.handle_validation_errors(error, res, next);
            const check_user = await userModel_1.userModel.findById(clientId);
            if (!check_user)
                return res.status(404).json({ error: "User not found" });
            const { campaignId, startDate, endDate, timePeriod } = body;
            ;
            let result = [];
            switch (timePeriod) {
                case "weekly":
                    console.log("weekly data");
                    const weekdates = (0, dateQuery_1.GetWeekRangeDates)(startDate, endDate);
                    console.log("Week Dates:", weekdates);
                    for (const week of weekdates) {
                        const start = week.monday;
                        const end = week.friday;
                        console.log("Week Start:", start, "Week End:", end);
                        const url = `${process.env.SMART_LEAD_URL}/campaigns/${campaignId}/top-level-analytics-by-date?api_key=${process.env.SMART_LEAD_API_KEY}&start_date=${start}&end_date=${end}`;
                        const response = await axios_1.default.get(url);
                        const response_data = response.data;
                        console.log("Response Data:", response_data);
                        const data = {
                            sent: response_data.sent_count,
                            opened: response_data.open_count,
                            clicked: response_data.click_count,
                            replied: response_data.reply_count,
                            bounced: response_data.bounce_count,
                        };
                        const graph_data = {
                            x: `${week.monday} - ${week.friday}`,
                            y: data,
                        };
                        console.log("Graph Data:", graph_data);
                        result.push(graph_data);
                    }
                    ;
                    break;
            }
            ;
            return res.status(200).json({
                success: true,
                message: "Email reach graph data fetched successfully",
                result
            });
            // console.log("Response Data:", response_data);
        }
        catch (error) {
            console.error("Error in email_reach_graph:", error);
            next(error);
        }
        ;
    }
    ;
}
;
exports.email_campaign_service = new EmailCampaignService();
