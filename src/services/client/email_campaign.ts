import RootService from "../_root";
import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/authRequest";
import axios from "axios";
import { EmailReachSchema } from "../../validations/client/email_campaign";
import { userModel } from "../../models/userModel";
import { GetMonthRangeDates, GetWeekRangeDates } from "../../utils/dateQuery";


class EmailCampaignService extends RootService {
    async email_reach_graph(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const clientId = req.user._id;
            const body = req.body;

            const { error } = EmailReachSchema.validate(body, {
                abortEarly: false
            });
            if (error) return this.handle_validation_errors(error, res, next);

            const check_user = await userModel.findById(clientId);
            if (!check_user) return res.status(404).json({ error: "User not found" });

            const { campaignId, startDate, endDate, timePeriod } = body;

            interface CampaignObject {
                id: number,
                user_id: number,
                created_at: string,
                status: string,
                name: string,
                start_date: string,
                end_date: string,
                total_count: string,
                sent_count: string,
                skipped_count: string,
                open_count: string,
                click_count: string,
                reply_count: string,
                bounce_count: string,
                unsubscribed_count: string,
                failed_count: string,
                stopped_count: string,
                ln_connection_req_pending_count: string,
                ln_connection_req_accepted_count: string,
                ln_connection_req_skipped_sent_msg_count: string,
                positive_reply_count: string
            };

            let result: Object[] = [];

            switch (timePeriod) {
                case "weekly":
                    console.log("weekly data");

                    const weekdates = GetWeekRangeDates(startDate, endDate) as Array<{ monday: string; friday: string }>;

                    for (const week of weekdates) {
                        const start = week.monday;
                        const end  = week.friday;

                        const url = `${process.env.SMART_LEAD_URL}/campaigns/${campaignId}/top-level-analytics-by-date?api_key=${process.env.SMART_LEAD_API_KEY}&start_date=${start}&end_date=${end}`;

                        const response = await axios.get(url);
                        const response_data = response.data as CampaignObject;

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
                        
                    };

                    break;

                case "monthly":
                    console.log("monthly data");

                    const monthDates = GetMonthRangeDates(startDate, endDate) as Array<{ first: string; last: string }>;
                    console.log("monthDates:", monthDates);

                    for (const month of monthDates) {
                        const start = month.first;
                        const end = month.last;

                        const url = `${process.env.SMART_LEAD_URL}/campaigns/${campaignId}/top-level-analytics-by-date?api_key=${process.env.SMART_LEAD_API_KEY}&start_date=${start}&end_date=${end}`;

                        const response = await axios.get(url);
                        const response_data = response.data as CampaignObject;

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

                    };

                    break;
                
                default:
                    return res.status(400).json({
                        success: false,
                        error: "Invalid timePeriod value"
                    });

            };

            return res.status(200).json({
                success: true,
                message: "Email reach graph data fetched successfully",
                result
            });

        } catch (error) {
            console.error("Error in email_reach_graph:", error);
            next(error);
        };
    };
};

export const email_campaign_service = new EmailCampaignService();