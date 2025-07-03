import RootService from "../_root";
import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/authRequest";
import axios from "axios";
import { EmailReachSchema } from "../../validations/client/email_campaign";
import { userModel } from "../../models/userModel";
import { DateOption } from "../../utils/types";
import { GetWeekRangeDates } from "../../utils/dateQuery";


class EmailCampaignService extends RootService {
    async email_reach_graph(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            console.log("In here");
            const clientId = req.user._id;
            const body = req.body;

            const { error } = EmailReachSchema.validate(body, {
                abortEarly: false
            });
            if (error) return this.handle_validation_errors(error, res, next);

            const check_user = await userModel.findById(clientId);
            if (!check_user) return res.status(404).json({ error: "User not found" });

            const { campaignId, startDate, endDate, timePeriod } = body;

            switch (timePeriod) {
                case "weekly":
                    console.log("weekly data");

                    const weekdates = GetWeekRangeDates(startDate, endDate);
                    console.log("Week Dates:", weekdates);
            };

            // const url = `${process.env.SMART_LEAD_URL}/campaigns/${campaignId}/analytics-by-date?api_key=${process.env.SMART_LEAD_API_KEY}&start_date=${startDate}&end_date=${endDate}`;
            // const response = await axios.get(url);
            // const response_data = response.data;

            // console.log("Response Data:", response_data);
        } catch (error) {
            console.error("Error in email_reach_graph:", error);
            next(error);
        };
    };
};

export const email_campaign_service = new EmailCampaignService();