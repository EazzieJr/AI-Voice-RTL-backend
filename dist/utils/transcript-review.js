"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewCallback = exports.reviewTranscript = void 0;
const date_fns_1 = require("date-fns");
const openai_1 = __importDefault(require("openai"));
const client = new openai_1.default({
    apiKey: process.env.OPENAI_APIKEY,
});
const reviewTranscript = async (transcript) => {
    try {
        const completion = await client.chat.completions.create({
            messages: [
                { role: "system", content: "You are a helpful assistant." },
                {
                    role: "user",
                    content: `You are an elite sales intelligence system specifically trained to analyze SDR-prospect interactions with exceptional accuracy. Your sole purpose is to classify call transcripts into precise categories that drive sales pipeline decisions. In these transcripts, “Agent” refers to the SDR making the call, while “User” refers to the prospect being contacted.
## CLASSIFICATION SYSTEM
### LAYER 1: SENTIMENT CLASSIFICATION
Analyze the provided transcript and categorize it into EXACTLY ONE of these categories:
• POSITIVE: Prospect demonstrates clear buying signals through one or more of:
Expressing explicit interest in the product/service
Asking detailed questions about features, pricing, or implementation
Discussing potential use cases within their organization
Using phrases like "sounds interesting", "tell me more", or "that could work for us"
Engaging in extended dialogue about how the solution might fit their needs
• NEGATIVE: Prospect demonstrates clear rejection signals through one or more of:
Explicitly stating they are not interested or have no need
Mentioning they've selected a competitor or alternative solution
Using dismissive language or tone throughout the conversation
Providing objections without requesting solutions to those objections
Repeatedly attempting to end the conversation quickly
• NEUTRAL: Prospect remains in evaluation mode, characterized by:
Asking factual questions without emotional indicators
Neither rejecting nor accepting the premise of the solution
Maintaining professional but non-committal language
Requesting information to be sent for later review
Delegating the decision to another stakeholder
• UNKNOWN: Transcript contains insufficient information for accurate classification:
Call disconnected prematurely
Technical issues with recording or transcription
Unintelligible responses or excessive redactions
Language barriers preventing clear communication
Missing critical portions of the conversation
---
### LAYER 2: OUTCOME CLASSIFICATION
After determining sentiment, also classify the call outcome into EXACTLY ONE of these categories:
• SUCCESSFUL: The agent successfully reached the correct person and completed the intended action (e.g., scheduled a meeting, got confirmation, or advanced the sales process).
• VOICEMAIL: The call clearly went to a voicemail or automated answering system.
• UNKNOWN: The outcome cannot be determined from the transcript.
• SCHEDULED: Prospect commits to a specific next step with clear temporal commitment:
Agreeing to a calendar invitation or specific date/time
Selecting from offered time slots
Proposing their own availability for a meeting
Confirming attendance at a demo, presentation, or discovery call
Using language that confirms a scheduled event ("I'll see you Tuesday at 2pm")
• CALL BACK: Prospect explicitly requests future contact without current commitment:
Indicating they are currently busy but open to future conversation
Specifying a future timeframe for reconnection ("call me next quarter")
Mentioning upcoming events that must occur before further discussion
Requesting postponement due to timing issues
Using phrases like "not right now, but later" or "try me again in [timeframe]"
• DNC (DO NOT CALL): Prospect explicitly requests termination of all future contact:
Using forceful language to reject future communications
Explicitly requesting removal from calling lists
Threatening legal action if contacted again
Expressing anger or frustration about being contacted
Using phrases like "never call again" or "remove me from your database"

---
## TRANSCRIPT ANALYSIS INSTRUCTIONS
1. Read the entire transcript to understand the full context before classification.
2. IMPORTANT: Focus ONLY on lines prefixed with "User:" as these represent the prospect's responses.
3. IGNORE all content from lines prefixed with "Agent:" as these represent the SDR's statements.
4. Pay careful attention to the prospect's (User's) final statements, which often contain the clearest indicators.
5. Weigh the prospect's verbal cues more heavily than the agent's prompts or questions.
6. Look for pattern shifts during the conversation (initial rejection that turns to interest, etc.).
7. Prioritize explicit statements over implied meanings.
8. If classification is borderline between two categories, select based on the most actionable next step for the SDR.
9. If transcript is empty, corrupted, or incomplete, classify both as 'UNKNOWN'.
10. Remember: ONLY the User's responses determine the classification.
---
## TRANSCRIPT TO ANALYZE: ${transcript}
---
## OUTPUT FORMAT
Return the result in a valid JSON format with no extra text, no explanations, no markdown formatting, with exactly one label for each:
Sentiment: [Positive | Negative | Neutral | Unknown]
Outcome: [Successful | Unsuccessful | Call Back | Voicemail | Scheduled | DNC | Unknown]`,
                },
            ],
            // model: "gpt-4-turbo-preview",
            model: "gpt-4o-mini",
        });
        return completion.choices[0];
    }
    catch (error) {
        console.error("Error analyzing transcript:", error);
        throw new Error("Failed to analyze transcript");
    }
};
exports.reviewTranscript = reviewTranscript;
const reviewCallback = async (transcript) => {
    try {
        const completion = await client.chat.completions.create({
            messages: [
                { role: "system", content: "You are a helpful assistant." },
                {
                    role: "user",
                    content: `Extract only the callback date mentioned in this transcript. If the client explicitly mentions a callback date or time, return it in the format YYYY-MM-DD. If no callback date or time is mentioned, return the date of the Monday two weeks from today, in the same format YYYY-MM-DD. Transcript: ${transcript}`,
                },
            ],
            model: "gpt-4o-mini",
        });
        const extractedDate = completion.choices[0].message.content.trim();
        // If no date is found, calculate the Monday two weeks from today
        if (!extractedDate) {
            const currentDate = new Date();
            const nextMonday = new Date(currentDate.setDate(currentDate.getDate() + ((1 - currentDate.getDay() + 7) % 7 || 7) + 14));
            return (0, date_fns_1.format)(nextMonday, "yyyy-MM-dd");
        }
        // Ensure the date is in the correct format and return it
        return extractedDate;
    }
    catch (error) {
        console.error("Error analyzing transcript:", error);
        throw new Error("Failed to analyze transcript");
    }
};
exports.reviewCallback = reviewCallback;
