import { model, Schema } from "mongoose";

const WebhookSchema = new Schema({}, { strict: false });

export const WebhookModel = model("Webhook", WebhookSchema);