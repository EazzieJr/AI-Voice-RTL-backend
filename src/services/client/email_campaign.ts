import RootService from "../_root";
import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/authRequest";
import axios from "axios";

class EmailCampaignService extends RootService {
    
};

export const email_campaign_service = new EmailCampaignService();