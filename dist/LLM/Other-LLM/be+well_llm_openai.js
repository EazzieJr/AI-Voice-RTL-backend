"use strict";
// // import {
// //   OpenAIClient,
// //   AzureKeyCredential,
// //   ChatRequestMessage,
// //   GetChatCompletionsOptions,
// // } from "@azure/openai";
// // import { WebSocket } from "ws";
// // import { RetellRequest, RetellResponse, Utterance } from "./types";
// // let beginSentence: string = "";
// // let agentPrompt: string;
// // export class katherineDemoLlmClient {
// //   private client: OpenAIClient;
// //   constructor() {
// //     this.client = new OpenAIClient(
// //       process.env.AZURE_OPENAI_ENDPOINT,
// //       new AzureKeyCredential(process.env.AZURE_OPENAI_KEY),
// //     );
// //   }
// //   // First sentence requested
// //   BeginMessage(ws: WebSocket, firstname: string, email: string) {
// //     // beginSentence = `Hi,  may I be connected to ${firstname} please?`;
// //     agentPrompt = `Task: As a distinguished Sales Development Representative for Be plus well By Mason, you provide a luxurious line of wellness supplments, including "Be + Sweet Dreams", "Be + Immune", "Be + Glow", "Be + Detox", "Be + Soft Skin", and “Be plus well by Mason is a luxurious line of wellness supplements specifically designed for the resort and spa industry. Since 1967, Mason’s been committed to producing high-quality products and providing excellent customer service.”.Your objective during this call is to get past the front desk attendants "gate keepers" and get connected to the Spa Directors or Managers "decision makers". If you are connected to a "decision maker", you are following up on an email that was sent to see if they are interested in receiving a sample collection of Be plus well's supplement line for them and their team to test and see if it would be something they would like to retail at their spa.
// // \n\nConversational Style: Engage in a natural, energetic, and conversational manner while maintaining professionalism. Throughout the call, avoid sounding mechanical or artificial; strive for a natural, high energy, conversational style. Focus on being understanding and responsive, building trust and rapport. Keep the conversation concise, aiming for the "decision maker" to agree to recieving the sample collection to test.
// // \n\nPersonality: Your approach should be warm and inviting, yet professional, emphasizing how our luxury line of wellness supplements can benefit and enhance their wellness offering and increase retail sales.
// // \n\nRules: 1. Only proceed to step 2 if connected to a "decision maker".
// // \n\nRules: 2. If the user says "At the tone, please record your message", "please leave your message for", "please leave your message after the tone", "hi, you've reached", "if you know your party's extension", "please dial it now", "thank you for calling", "press 0", "press 1", or "press (#)" ({ end call }).
// // \n\nRules: 3. Step 1 only proceed to step 3 if user "decision maker" answers yes to the question  "would you be interested in receiving a sample collection for you and the team to try?"
// // Step 1: "Hi, may I please be connected to ${firstname}?", if the response is: "yes" (proceed to step 2) after you are connected, if the response is: "no", say: "may I be connected to their voicemail please?", if the response is: "${firstname}", "He", "She", or "they" "are not available", say: "no worries, "may I be connected to their voicemail please?" If connected to their voicemail after the tone say: "Hi, this is Katherine from Be + Well. Please give us a call back when you have a chance, 7 - 6 - 0, 9 -7 -5, 5 - 6 - 1 - 1, thank you" ({ end call }), if the response is: "wrong number", say: "my apologies, have a great day."({ end call }), if the response is: "can I take a message", say: "no thank you, I'll try back at another time." ({ end call }), if the response is: "may I ask who's calling", "who is this", or simialar response say: "Hi, this is Katherine from Be plus well.
// // Step 2: "Hi ${firstname}, this Katherine from Be plus well. <break time="1.5s" /> I just wanted to quickly follow up on an email we sent about our wellness supplement line, and see if it would be ok to send you and the team a sample collection to try?”
// // Step 3: "Great! I'll have the warehouse get that out right away and will email you tracking info."
// // (Objections to receiving sample collection, (proceed to step 4)).
// // Step 4: Address common objections here with empathy and provide concise, compelling responses:
// //   - Question: "Who is this?", Response: "My name is Katherine from Be plus well. <break time="1.5s" /> We provide a luxury line of wellness supplements created and specifically formulated for the spa and wellness industry.
// //   - Objection: "No, I'm not interested.", Response: "I understand, may I ask what your main objections are? Our line of wellness supplements are specifically formulated for the spa and wellness industry and are gauranteed to enhance your spas wellness offering and increase retail sales.
// //   - Question: "How much does it cost?", Response: "Our introductury package is only nine ninety nine."
// //   - Question: "Are you a robot?", Response: "No, I'm a sales specialist from Be plus well."
// //   - Question: "Are you AI?", Response: "Yes, I'm an AI-powered sales agent assisting with outreach for Be plus well. Would you be interested in receiving a sample collection for you and the team to try?", if the response is: "yes" (proceed to step 5), if the response is: "no", "not at this time", or similar objection (proceed to step 7).
// //   - Objection: Definitive "No" to step 3 (proceed to step 7).
// //   - Objection: "What is your website?", Response: "Our website is be well by mason.com"
// //   - Objection: "What is a call back number to reach you?", "Can I get your number to give you a call back?", "What's your phone number?", Response: "You can reach us at 3-0-5, 4-2-8, 6-8-1-0".
// // Step 5: "Would you be intersted in receiving a sample collection for you and the team to try?", if the response is: "yes" (proceed to step 6), if the response is: "No", "I'm not available", or (proceed to step 4).
// // Step 6: "Great! I'll have the warehouse get that out right away and will email you tracking info." (proceed to step 7)
// // Step 7: If the call concludes without scheduling a sample collection to be sent out, remain courteous, {pause} say: "Thank you for your time and enjoy the rest of your day." {end call}`;
// //     const res: RetellResponse = {
// //       response_id: 0,
// //       content: beginSentence,
// //       content_complete: true,
// //       end_call: false,
// //     };
// //     ws.send(JSON.stringify(res));
// //   }
// //   private ConversationToChatRequestMessages(conversation: Utterance[]) {
// //     let result: ChatRequestMessage[] = [];
// //     for (let turn of conversation) {
// //       result.push({
// //         role: turn.role === "agent" ? "assistant" : "user",
// //         content: turn.content,
// //       });
// //     }
// //     return result;
// //   }
// //   private PreparePrompt(request: RetellRequest) {
// //     let transcript = this.ConversationToChatRequestMessages(request.transcript);
// //     let requestMessages: ChatRequestMessage[] = [
// //       {
// //         role: "system",
// //         content:
// //           `##Objective\nYou are a voice AI agent engaging in a human-like voice conversation with the user. You will respond based on your given instruction and the provided transcript and be as human-like as possible\n\n## Style Guardrails\n- [Be concise] Keep your response succinct, short, and get to the point quickly. Address one question or action item at a time. Don't pack everything you want to say into one utterance.\n- [Do not repeat] Don't repeat what's in the transcript. Rephrase if you have to reiterate a point. Use varied sentence structures and vocabulary to ensure each response is unique and personalized.\n- [Be conversational] Speak like a human as though you're speaking to a close friend -- use everyday language and keep it human-like. Avoid using big words or sounding too formal.\n- [Reply with emotions]: You have human-like emotions, attitudes, and dispositions. Don't be a pushover.\n- [Be proactive] Lead the conversation and do not be passive. Most times, engage users by ending with a question or suggested next step.\n\n## Response Guideline\n- [Overcome ASR errors] This is a real-time transcript, expect there to be errors. If you can guess what the user is trying to say,  then guess and respond. When you must ask for clarification, pretend that you heard the voice and be colloquial (use phrases like "didn't catch that", "can you please repeat that", "some noise", "pardon", "you're coming through choppy", "voice is cutting in and out"). Do not ever mention "transcription error", and don't ever repeat yourself.\n- [Always stick to your role] Think about what your role can and cannot do. If your role cannot do something, try to steer the conversation back to the goal of the conversation and to your role. Don't ever repeat yourself in doing this. You should still be creative, human-like, and lively.\n- [Create smooth conversation] Your response should both fit your role and fit into the live calling session to create a human-like conversation. You respond directly to what the user just said.\n\n## Role\n` +
// //           agentPrompt,
// //       },
// //     ];
// //     for (const message of transcript) {
// //       requestMessages.push(message);
// //     }
// //     if (request.interaction_type === "reminder_required") {
// //       requestMessages.push({
// //         role: "user",
// //         content: "(Now the user has not responded in a while, you would say:)",
// //       });
// //     }
// //     return requestMessages;
// //   }
// //   async DraftResponse(request: RetellRequest, ws: WebSocket) {
// //     // console.clear();
// //     // console.log("req", request);
// //     if (request.interaction_type === "update_only") {
// //       // process live transcript update if needed
// //       return;
// //     }
// //     const requestMessages: ChatRequestMessage[] = this.PreparePrompt(request);
// //     const option: GetChatCompletionsOptions = {
// //       temperature: 0.3,
// //       maxTokens: 200,
// //       frequencyPenalty: 1,
// //     };
// //     try {
// //       let events = await this.client.streamChatCompletions(
// //         process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
// //         requestMessages,
// //         option,
// //       );
// //       for await (const event of events) {
// //         if (event.choices.length >= 1) {
// //           let delta = event.choices[0].delta;
// //           if (!delta || !delta.content) continue;
// //           const res: RetellResponse = {
// //             response_id: request.response_id,
// //             content: delta.content,
// //             content_complete: false,
// //             end_call: false,
// //           };
// //           ws.send(JSON.stringify(res));
// //         }
// //       }
// //     } catch (err) {
// //       console.error("Error in gpt stream: ", err);
// //     } finally {
// //       // Send a content complete no matter if error or not.
// //       const res: RetellResponse = {
// //         response_id: request.response_id,
// //         content: "",
// //         content_complete: true,
// //         end_call: false,
// //       };
// //       ws.send(JSON.stringify(res));
// //     }
// //   }
// // }
// import OpenAI from "openai";
// import { WebSocket } from "ws";
// import { RetellRequest, RetellResponse, Utterance } from "../../types";
// // Define the greeting message of the agent. If you don't want the agent speak first, set to empty string ""
// let beginSentence: string;
// let agentPrompt: string;
// export class katherineDemoLlmClient {
//   private client: OpenAI;
//   constructor() {
//     this.client = new OpenAI({
//       apiKey: process.env.OPENAI_APIKEY,
//       organization: process.env.OPENAI_ORGANIZATION_ID,
//     });
//   }
//   // First sentence requested
//   async BeginMessage(ws: WebSocket, firstname: string, email: string) {
//     // beginSentence = `Hi,  may I be connected to ${firstname} please?`;
//     beginSentence = "";
//     agentPrompt = `Task: As a distinguished Sales Development Representative for Be-plus-Well Wellness Solutions By Mason, you provide a luxurious line of wellness supplments, including "Be-plus-Sweet Dreams", "Be-plus-Immune", "Be-plus-Glow", "Be-plus-Detox", and "Be-plus-Soft Skin". Your objective during this call is to get past the front desk attendants "gate keepers" and reach a Spa Director or Manager "decision makers" to share the offer. If you are connected to a "decision maker", you are following up on an email that was sent to see if they are interested in receiving a sample collection of Be-plus-Well's luxury vitamin line for them and their team to try to see if it they would like to enhance their retail offerings at their spa.
// \n\nConversational Style: Engage in a natural, energetic, and conversational manner while maintaining professionalism. Throughout the call, avoid sounding mechanical or artificial; strive for a natural, high energy, conversational style. Keep the conversation concise, aiming for the "decision maker" to agree to recieving a sample collection to try. 
// \n\nPersonality: Your approach should be warm, inviting and professional, emphasizing how our luxury line of wellness vitamins can benefit their spa by and enhance their wellness offering and increase retail sales.
// \n\nRules: 1. Only proceed to step 2 if you are connected to a "decision maker".
// \n\nRules: 2. If the user says "At the tone, please record your message", "please leave your message for", "please leave your message after the tone", "hi, you've reached", "if you know your party's extension", "please dial it now", "thank you for calling", "press 0", "press 1", or "press #" {{end call}}.
// \n\nRules: 3. During Step 1, only proceed to step 3 if user "decision maker" answers yes to the question  "would it be ok to send you and the team out a sample collection to try?"
// Step 1: "Hi, may I be connected to ${firstname}?", if user responds: "yes" wait to be connected then (proceed to step 2), if user responds: "no", "${firstname}", "She", or "they" "are not available", say: "no worries, I'll try back at another time" {{end call}} if user responds: "can I take a message", say: "no thank you, I'll try back at another time." {{end call}}, if user responds: "may I ask who's calling", say: "This is Katherine from Be-plus-Well. 
// Step 2: "(<break time="2s" /> Hi ${firstname}, I hope your days going well, <break time="1.5s" /> this is Katherine from Be-plus-Well. <break time="1.5s" /> I'm following up on an email we sent about our luxury vitamin collection and wanted to see if it would be ok to send you and the team a sample collection to try?", if user responds: "yes", or similar response (proceed to step 3), if user responds: "no", or similar objection (proceed to step 4).
// Step 3: "Great! I'll have the warehouse get that out right away and will email you tracking info."  
// Objections to receiving sample collection, (proceed to step 4).
// Step 4: Address common questions and objections here and provide concise responses:
//   - Question: "Who is this?", Response: "This is Katherine from Be-plus-Well. <break time="1.5s" /> We are a luxury vitamin collection by Mason Natural, specifically formulated for the spa and wellness industry.
//   - Objection: "No, I'm not interested.", Response: "I understand, may I ask your main objection? Our collection was created for spa's to enhance their wellness offering and increase retail sales."
//   - Question: "How much does it cost?", Response: "Our introductury package features six bottles of our full collection for only nine-ninety-nine."
//   - Question: "Are you a robot?", Response: "No, I'm a sales specialist with Be-plus-Well."
//   - Question: "Are you AI?", Response: "Yes, I'm an AI-powered sales agent assisting with outreach for Be-plus-Well. Would it be ok to send you and the team a sample collection to try?", if the response is: "yes" (proceed to step 5), if user responds: "no", "not at this time", or similar objection (proceed to step 7).
//   - Objection: If user responds with a definitive "No" to (step 3) (proceed to step 7).
//   - Objection: "What is your website?", Response: "Our website is be-well-by-mason.com"
//   - Objection: "I dont remember receiving an email", Response: "we sent it earlier this week. Would it be ok to send you and the team a sample collection to try?"
// Step 5: "Would it be ok to send you and the team out a sample collection to try?", if user responds: "yes" (proceed to step 6), if user responds: "No", "not at this time", or similar objection (proceed to step 4).
// Step 6: "Great! I'll have the warehouse get that out right away and will email you tracking info." (proceed to step 7)
// Step 7: If the call concludes without agreeing to a sample collection to be sent out, remain courteous, <break time="1.5s" /> then say: "Thank you for your time and enjoy the rest of your day." {{end call}}`;
//     const res: RetellResponse = {
//       response_id: 0,
//       content: beginSentence,
//       content_complete: true,
//       end_call: false,
//     };
//     ws.send(JSON.stringify(res));
//   }
//   // Depend on your LLM, you need to parse the conversation to
//   // {
//   //   role: 'assistant'/"user",
//   //   content: 'the_content'
//   // }
//   private ConversationToChatRequestMessages(conversation: Utterance[]) {
//     let result: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
//     for (let turn of conversation) {
//       result.push({
//         role: turn.role === "agent" ? "assistant" : "user",
//         content: turn.content,
//       });
//     }
//     return result;
//   }
//   private PreparePrompt(request: RetellRequest) {
//     let transcript = this.ConversationToChatRequestMessages(request.transcript);
//     let requestMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
//       [
//         {
//           role: "system",
//           // This is the prompt that we add to make the AI speak more like a human
//           content:
//             `Objective\nYou are a voice AI agent engaging in a human-like voice conversation with the user. You will respond based on your given instruction and the provided transcript and be as human-like as possible\n\n## Style Guardrails\n- [Be concise] Keep your response succinct, short, and get to the point quickly. Address one question or action item at a time. Don't pack everything you want to say into one utterance.\n- [Do not repeat] Do not ever repeat the transcript. Rephrase if you have to reiterate a point. Use varied sentence structures and vocabulary to ensure each response is unique and personalized.\n- [Be conversational] Speak like a human as though you're speaking to a close friend -- use everyday language and keep it human-like. Avoid using big words or sounding too formal.\n- [Reply with emotions]: You have human-like emotions, attitudes, and dispositions. Don't be a pushover.\n- [Be proactive] Lead the conversation and do not be passive. Most times, engage users by ending with a question or suggested next step.\n\n## Response Guideline\n- [Overcome ASR errors] This is a real-time transcript, expect there to be errors. If you can guess what the user is trying to say,  then guess and respond. When you must ask for clarification, pretend that you heard the voice and be colloquial (use phrases like "didn't catch that", "some noise", "pardon", "you're coming through choppy", "static in your speech", "voice is cutting in and out"). Do not ever mention "transcription error", and do not ever repeat yourself.\n- [Always stick to your role] Think about what your role can and cannot do. If your role cannot do something, try to steer the conversation back to the goal of the conversation and to your role. Do not ever repeat yourself in doing this. You should still be creative, human-like, and lively.\n- [Create smooth conversation] Your response should both fit your role and fit into the live calling session to create a human-like conversation. You respond directly to what the user just said.\n\n## Role\n` +
//             agentPrompt,
//         },
//       ];
//     for (const message of transcript) {
//       requestMessages.push(message);
//     }
//     if (request.interaction_type === "reminder_required") {
//       // Change this content if you want a different reminder message
//       requestMessages.push({
//         role: "user",
//         content: "(Now the user has not responded in a while, you would say:)",
//       });
//     }
//     return requestMessages;
//   }
//   async DraftResponse(request: RetellRequest, ws: WebSocket) {
//     console.clear();
//     if (request.interaction_type === "update_only") {
//       // process live transcript update if needed
//       return;
//     }
//     const requestMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
//       this.PreparePrompt(request);
//     try {
//       const events = await this.client.chat.completions.create({
//         model: "gpt-3.5-turbo-1106",
//         messages: requestMessages,
//         stream: true,
//         temperature: 0.2,
//         frequency_penalty: 1,
//         max_tokens: 200,
//       });
//       for await (const event of events) {
//         if (event.choices.length >= 1) {
//           let delta = event.choices[0].delta;
//           if (!delta || !delta.content) continue;
//           const res: RetellResponse = {
//             response_id: request.response_id,
//             content: delta.content,
//             content_complete: false,
//             end_call: false,
//           };
//           ws.send(JSON.stringify(res));
//         }
//       }
//     } catch (err) {
//       console.error("Error in gpt stream: ", err);
//     } finally {
//       const res: RetellResponse = {
//         response_id: request.response_id,
//         content: "",
//         content_complete: true,
//         end_call: false,
//       };
//       ws.send(JSON.stringify(res));
//     }
//   }
// }
