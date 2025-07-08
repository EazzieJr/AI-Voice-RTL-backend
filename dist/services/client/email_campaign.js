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
            const start = new Date(startDate);
            const end = new Date(endDate);
            const msInDay = 24 * 60 * 60 * 1000;
            const daysBetween = Math.floor((end.getTime() - start.getTime()) / msInDay) + 1;
            console.log("Days between:", daysBetween);
            if (daysBetween <= 14) {
                console.log("Fetching daily data");
                const dates = [];
                let current = new Date(start);
                while (current <= end) {
                    dates.push(current.toISOString().split('T')[0]);
                    current.setDate(current.getDate() + 1);
                }
                ;
                for (const date of dates) {
                    const url = `${process.env.SMART_LEAD_URL}/campaigns/${campaignId}/top-level-analytics-by-date?api_key=${process.env.SMART_LEAD_API_KEY}&start_date=${date}&end_date=${date}`;
                    const response = await axios_1.default.get(url);
                    const response_data = response.data;
                    const data = {
                        sent: response_data.sent_count,
                        opened: response_data.open_count,
                        clicked: response_data.click_count,
                        replied: response_data.reply_count,
                        bounced: response_data.bounce_count,
                    };
                    const graph_data = {
                        x: date,
                        y: data,
                    };
                    result.push(graph_data);
                }
                ;
                console.log("Daily data fetched successfully");
            }
            else {
                console.log("Fetching weekly data");
            }
            ;
            return res.status(200).json({
                success: true,
                message: "Email reach graph data fetched successfully",
                result
            });
            switch (timePeriod) {
                case "weekly":
                    console.log("weekly data");
                    const weekdates = (0, dateQuery_1.GetWeekRangeDates)(startDate, endDate);
                    console.log("weekdates:", weekdates);
                    for (const week of weekdates) {
                        const start = week.monday;
                        const end = week.friday;
                        const url = `${process.env.SMART_LEAD_URL}/campaigns/${campaignId}/top-level-analytics-by-date?api_key=${process.env.SMART_LEAD_API_KEY}&start_date=${start}&end_date=${end}`;
                        const response = await axios_1.default.get(url);
                        const response_data = response.data;
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
                        result.push(graph_data);
                    }
                    ;
                    break;
                case "monthly":
                    console.log("monthly data");
                    const monthDates = (0, dateQuery_1.GetMonthRangeDates)(startDate, endDate);
                    console.log("monthDates:", monthDates);
                    for (const month of monthDates) {
                        const start = month.first;
                        const end = month.last;
                        const url = `${process.env.SMART_LEAD_URL}/campaigns/${campaignId}/top-level-analytics-by-date?api_key=${process.env.SMART_LEAD_API_KEY}&start_date=${start}&end_date=${end}`;
                        const response = await axios_1.default.get(url);
                        const response_data = response.data;
                        const data = {
                            sent: response_data.sent_count,
                            opened: response_data.open_count,
                            clicked: response_data.click_count,
                            replied: response_data.reply_count,
                            bounced: response_data.bounce_count,
                        };
                        const graph_data = {
                            x: `${month.first} - ${month.last}`,
                            y: data,
                        };
                        result.push(graph_data);
                    }
                    ;
                    break;
                default:
                    return res.status(400).json({
                        success: false,
                        error: "Invalid timePeriod value"
                    });
            }
            ;
            return res.status(200).json({
                success: true,
                message: "Email reach graph data fetched successfully",
                result
            });
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
