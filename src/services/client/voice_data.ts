import RootService from "../_root";
import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/authRequest";


class VoiceDataService extends RootService {

};

export const voice_data_service = new VoiceDataService();