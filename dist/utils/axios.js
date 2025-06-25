"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listEventTypes = listEventTypes;
exports.createEvent = createEvent;
const axios_1 = __importDefault(require("axios"));
const apiToken = process.env.CALLENDY_API;
const headers = {
    'Authorization': `Bearer ${apiToken}`,
    'Content-Type': 'application/json'
};
async function listEventTypes() {
    try {
        const response = await axios_1.default.get('https://api.calendly.com/event_types', { headers });
        return response.data;
    }
    catch (error) {
        console.error('Failed to retrieve event types:', error);
        return null;
    }
}
async function createEvent(email, eventTypeUuid, startTime, endTime) {
    try {
        const data = {
            event_type_uuid: eventTypeUuid,
            start_time: startTime,
            end_time: endTime,
            invitees: [
                { email }
            ]
        };
        const response = await axios_1.default.post('https://api.calendly.com/scheduled_events', data, { headers });
        return response.data;
    }
    catch (error) {
        console.error('Failed to create event:', error);
        return null;
    }
}
