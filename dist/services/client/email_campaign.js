"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.email_campaign_service = void 0;
const _root_1 = __importDefault(require("../_root"));
const email_campaign_1 = require("../../validations/client/email_campaign");
const userModel_1 = require("../../models/userModel");
const types_1 = require("../../utils/types");
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
            const dateOption = req.body.dateOption;
            const { campaignId, startDate, endDate } = body;
            switch (dateOption) {
                case types_1.DateOption.ThisWeek:
                    console.log("This week");
                    const weekdates = (0, dateQuery_1.NormalizeWeekRange)(startDate, endDate);
                    console.log("week dates: ", weekdates);
                    const dates = (0, dateQuery_1.GetWeekBounds)(startDate, endDate);
                    console.log("Dates: ", dates);
            }
            // const url = `${process.env.SMART_LEAD_URL}/campaigns/${campaignId}/analytics-by-date?api_key=${process.env.SMART_LEAD_API_KEY}&start_date=${startDate}&end_date=${endDate}`;
            // const response = await axios.get(url);
            // const response_data = response.data;
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
