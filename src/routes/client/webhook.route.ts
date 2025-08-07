import express, { Request, Response } from "express";
import { client_webhook_service } from "../../services/client/webhook";

const router = express.Router();

router
    .post("/email-update-webhook", (request: Request, response: Response) => client_webhook_service.email_update_webhook(request, response));

export default router;