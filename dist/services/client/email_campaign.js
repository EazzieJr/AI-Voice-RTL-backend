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
const date_fns_tz_1 = require("date-fns-tz");
class EmailCampaignService extends _root_1.default {
    async campaign_details_analytics(req, res, next) {
        try {
            const clientId = req.user._id;
            const body = req.body;
            const { error } = email_campaign_1.CampaignDetailsAndEmailReachSchema.validate(body, { abortEarly: false });
            if (error)
                return this.handle_validation_errors(error, res, next);
            const check_user = await userModel_1.userModel.findById(clientId);
            if (!check_user)
                return res.status(400).json({ error: "User not found" });
            const { campaignId, startDate, endDate } = body;
            let start_date;
            let end_date;
            const timeZone = "America/Los_Angeles";
            const now = new Date();
            const zonedNow = (0, date_fns_tz_1.toZonedTime)(now, timeZone);
            if (startDate) {
                start_date = new Date(startDate).toISOString().split("T")[0];
            }
            else {
                // If startDate doesn't exist, set it to exactly one week before zonedNow
                const weekBefore = new Date(zonedNow);
                weekBefore.setDate(weekBefore.getDate() - 7);
                start_date = weekBefore.toISOString().split("T")[0];
            }
            ;
            if (endDate) {
                end_date = new Date(endDate).toISOString().split("T")[0];
            }
            else {
                // If endDate doesn't exist, set it to the current date
                end_date = zonedNow.toISOString().split("T")[0];
            }
            ;
            // Validate that end_date is not before start_date
            if (new Date(end_date) < new Date(start_date)) {
                return res.status(400).json({ message: "End date must not be before start date" });
            }
            console.log("start_date: ", start_date);
            console.log("end_date: ", end_date);
            const url = `${process.env.SMART_LEAD_URL}/campaigns/${campaignId}/sequence-analytics?api_key=${process.env.SMART_LEAD_API_KEY}&start_date=${start_date}&end_date=${end_date}`;
            const response = await axios_1.default.get(url);
            const response_details = response.data;
            const response_data = response_details.data;
            if (!response_data)
                return res.status(400).json({ message: "No data found for the campaign" });
            ;
            const sequences = [];
            if (response_data.length > 0) {
                for (const data of response_data) {
                    const details = {
                        sequenceId: data.email_campaign_seq_id,
                        sentCount: data.sent_count,
                        reply: data.reply_count,
                        positiveReplies: data.positive_reply_count,
                        bounced: data.bounce_count,
                        unsubscribed: data.unsubscribed_count,
                    };
                    sequences.push(details);
                }
                ;
            }
            ;
            // Email Reach Graph Data
            const msInDay = 24 * 60 * 60 * 1000;
            const daysBetween = Math.floor((new Date(end_date).getTime() - new Date(start_date).getTime()) / msInDay) + 1;
            console.log("Days between:", daysBetween);
            let emailReachGraph = [];
            if (daysBetween <= 14) {
                console.log("Fetching daily data");
                const dates = [];
                let current = new Date(start_date);
                while (current <= new Date(end_date)) {
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
                        positiveReplies: response_data.positive_reply_count,
                    };
                    console.log("Data for date:", date, data);
                    const graph_data = {
                        x: date,
                        y: data,
                    };
                    if (data.sent > 0 || data.opened > 0 || data.clicked > 0 || data.replied > 0 || data.bounced > 0 || data.positiveReplies > 0) {
                        emailReachGraph.push(graph_data);
                    }
                    ;
                }
                ;
                console.log("Daily data fetched successfully");
            }
            else {
                console.log("Fetching weekly data");
                const weekdates = (0, dateQuery_1.GetWeekRangeDates)(new Date(start_date), new Date(end_date));
                for (const week of weekdates) {
                    const start = week.monday;
                    const end = week.sunday;
                    const url = `${process.env.SMART_LEAD_URL}/campaigns/${campaignId}/top-level-analytics-by-date?api_key=${process.env.SMART_LEAD_API_KEY}&start_date=${start}&end_date=${end}`;
                    const response = await axios_1.default.get(url);
                    const response_data = response.data;
                    const data = {
                        sent: response_data.sent_count,
                        opened: response_data.open_count,
                        clicked: response_data.click_count,
                        replied: response_data.reply_count,
                        bounced: response_data.bounce_count,
                        positiveReplies: response_data.positive_reply_count,
                    };
                    const graph_data = {
                        x: `${week.monday} - ${week.sunday}`,
                        y: data,
                    };
                    if (data.sent > 0 || data.opened > 0 || data.clicked > 0 || data.replied > 0 || data.bounced > 0 || data.positiveReplies > 0) {
                        emailReachGraph.push(graph_data);
                    }
                }
                ;
            }
            ;
            return res.status(200).json({
                success: true,
                result: {
                    sequences,
                    emailReachGraph
                }
            });
        }
        catch (e) {
            console.error("Error fetching single campaign analytics: " + e);
            next(e);
        }
        ;
    }
    ;
}
;
exports.email_campaign_service = new EmailCampaignService();
