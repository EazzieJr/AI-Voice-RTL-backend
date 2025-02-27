import { model, Schema } from "mongoose";

export interface IReply {
    _id: string;
    campaign_name?: string;
    campaign_id?: number;
    client_id?: number;
    webhook_id?: number;
    webhook_name?: string;
    campaign_status?: string;
    message_id?: string;
    stats_id?: string;
    from_email: string;
    preview_text?: string;
    subject?: string;
    time_replied?: string;
    sent_message?: {
        message_id?: string;
        html?: string;
        text?: string;
        time?: string;
    };
    to_email: string;
    to_name?: string;
    event_timestamp?: string;
    promptType?: string;
    reply_body?: string;
    reply_category?: number;
    reply_message?: {
        message_id?: string;
        html?: string;
        text?: string;
        time?: string;
    };
    sent_message_body?: string;
    sequence_number?: number;
    secret_key?: string;
    app_url?: string;
    description?: string;
    ui_master_inbox_link?: string;
    metadata?: {
        webhook_created_at?: Date;
    };
    event_type?: string;
    sl_email_lead_id?: number;
    sl_email_lead_map_id?: number;
    sl_lead_email?: string;
    replied_to?: boolean;
    mail_read?: boolean;
    phone?: number;
    is_meeting_request?: boolean;
}

const replySchema = new Schema<IReply>({
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
    },
    mail_read: {
        type: Boolean
    },
    phone: {
        type: Number
    },
    is_meeting_request: {
        type: Boolean
    }
}, { timestamps: true });

export const ReplyModel = model<IReply>("EmailReply", replySchema);

// export const ReplyModel = model("EmailReply", replySchema);
