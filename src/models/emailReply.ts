import { model, Schema } from "mongoose";

const replySchema = new Schema({
    client: {
        type: Schema.Types.ObjectId,
        required: [true, "Client is required"],
        ref: "User"
    },
    campaignName: {
        type: String
    },
    campaignId: {
        type: Number
    },
    clientId: {
        type: Number
    },
    webhookId: {
        type: Number
    },
    webhookName: {
        type: String
    },
    campaignStatus: {
        type: String
    },
    statsId: {
        type: String
    },
    fromEmail: {
        type: String,
        required: [true, "From email is required"]
    },
    subject: {
        type: String
    },
    sentMessage: {
        messageId: String,
        html: String,
        text: String,
        time: String
    },
    toEmail: {
        type: String,
        required: [true, "To email is required"]
    },
    toName: {
        type: String
    },
    eventTimestamp: {
        type: String
    },
    replyMessage: {
        messageId: String,
        html: String,
        text: String,
        time: String
    },
    sequenceNumber: {
        type: Number
    },
    secretKey: {
        type: String
    },
    appUrl: {
        type: String
    },
    description: {
        type: String
    },
    metadata: {
        webhookCreatedAt: String
    },
    webhookUrl: {
        type: String
    },
    eventType: {
        type: String
    },
    slEmailLeadId: {
        type: Number
    },
    slEmailLeadMapId: {
        type: Number
    },
    slLeadEmail: {
        type: String
    },
    repliedTo: {
        type: Boolean,
        required: true,
        default: false
    }
}, { timestamps: true });

export const ReplyModel = model("EmailReply", replySchema);
