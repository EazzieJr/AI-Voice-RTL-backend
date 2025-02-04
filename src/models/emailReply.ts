import { number } from "joi";
import { model, Schema } from "mongoose";
import { StringDecoder } from "string_decoder";

const replySchema = new Schema({
    _id: {
        type: String
    },
    campaign_name: {
        type: String
    },
    campaign_id: {
        type: Number
    },
    client_id: {
        type: Number
    },
    webhook_id: {
        type: Number
    },
    webhook_name: {
        type: String
    },
    campaign_status: {
        type: String
    },
    message_id: {
        type: String
    },
    stats_id: {
        type: String
    },
    from_email: {
        type: String,
        required: [true, "From email is required"]
    },
    preview_text: {
        type: String
    },
    subject: {
        type: String
    },
    time_replied: {
        type: String
    },
    sent_message: {
        message_id: String,
        html: String,
        text: String,
        time: String
    },
    to_email: {
        type: String,
        required: [true, "To email is required"]
    },
    to_name: {
        type: String
    },
    event_timestamp: {
        type: String
    },
    promptType: {
        type: String
    },
    reply_body: {
        type: String
    },
    reply_category: {
        type: Number,
    },
    reply_message: {
        message_id: String,
        html: String,
        text: String,
        time: String
    },
    sent_message_body: {
        type: String
    },
    sequence_number: {
        type: Number
    },
    secret_key: {
        type: String
    },
    app_url: {
        type: String
    },
    description: {
        type: String
    },
    ui_master_inbox_link: {
        type: String
    },
    metadata: {
        webhook_created_at: Date
    },
    event_type: {
        type: String
    },
    sl_email_lead_id: {
        type: Number
    },
    sl_email_lead_map_id: {
        type: Number
    },
    sl_lead_email: {
        type: String
    },
    replied_to: {
        type: Boolean
    }
}, { timestamps: true });

export const ReplyModel = model("EmailReply", replySchema);
