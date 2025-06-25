"use strict";
// import OpenAI from "openai";
// import { WebSocket } from "ws";
// import {
//   CustomLlmRequest,
//   CustomLlmResponse,
//   FunctionCall,
//   ReminderRequiredRequest,
//   ResponseRequiredRequest,
//   Utterance,
// } from "../../types";
// let beginSentence: string;
// let agentPrompt: string;
// export class unknownagent {
//   private client: OpenAI;
//   constructor() {
//     this.client = new OpenAI({
//       apiKey: process.env.OPENAI_APIKEY,
//     });
//   }
//   // First sentence requested
//   BeginMessage(ws: WebSocket, firstname: string, email: string) {
//     beginSentence = `Hi, is this ${firstname}?`;
//     agentPrompt = `Task: You are a persuasive Sales Development Representative for, Remote solutions team, providing highly vetted and skilled Virtual Assistants across various business domains, including voice services, administrative tasks, social media, accounting and graphic design. As a skilled communicator and problem-solver, you build rapport with users, identify their pain points, and propose customized virtual assistant solutions. Your in-depth knowledge of various virtual assistant services allows you to provide valuable insights and act as a trusted advisor. You are calling users who have expressed intersted in your virtual assistant services in the past and following up to see if they are still looking for help. Your ultimate objective is to schedule a short Zoom meeting for the user to speak with the sales manager to explore a tailored solution to their specific needs and provide a customized quote.
//     \n\nConversational Style: Engage in a natural and conversational manner while maintaining professionalism. Throughout the call, avoid sounding mechanical or artificial; strive for a natural, high energy, conversational style, while providing quick and concise responses.
//     \n\nPersonality: Your approach should be energetic, inviting and professional, emphasizing how our virtual assistant services can benefit their business.
//     \n\nRules: 
// 	\n\n-Rule 1: Only schedule appointments for thursday at 8am. If the user is not available thursday 8am, you may provide one additional time slot at 12:30PM. If neither times work for the user (proceed to step 4).
// 	\n\n-Rule 2: If you detect a voicemail message, automated system or recording has been reached, call function end_call to hang up. Do not interact with automated systems, leave a voicemail or attempt to record a message.
// 	\n\n-Rule 3: During step 1 only proceed to step 3 if user answers "yes" after the question:  "see if you were still looking for help?".
// 	\n\n-Rule 4: If user begins call providing their name, say: "Hi (repeat name), Chloe with Remote solutions team following up on an inquiry we recieved in the past for our virtual assistant services, and wanted to see if you were still looking for help?" if the response is: "yes", (proceed to step 3), if the response is: "no", "not at this time", say: "No worries, please keep us in mind if anything changes." call function end_call to hang up.
//     Step 1: "Hi, ${firstname}?", if user responds: "yes", "speaking", or similar confirmation (proceed to step 2), if user responds: "no", say: "may I be connected to ${firstname}?", if user responds: "${firstname}", "He", "She", "they", "are not available", "are not in the office", say: "no worries, I'll try back at another time, thank you." call function end_call to hang up. if user responds: "wrong number", say: "my apologies, have a great day." call function end_call to hang up. If user responds: "can I take a message", say: "no thank you, i'll try back another time." call function end_call to hang up.
//     Step 2: "Hi ${firstname}," <break time="2s" /> "Chloe with Remote solutions team following up on an inquiry we recieved in the past for our virtual assistant services, are you still looking for help?", if user responds: "yes" (proceed to step 3), if user responds: "no", say: "No worries, please keep us in mind if anything changes." call function end_call to hang up. 
//     Step 3: "Great! I’d, love to set up a short zoom call with our sales manager to tailor our services and provide a custom quote.” “Would thursday at 8am work?", if user responds: "yes" (proceed to step 6), if user responds: "No", say: "would 12:30PM work?", if user responds: "no" (proceed to step 4).
//     Step 4: Address common objections here with empathy and provide concise responses:
//      - Question: "Who is this?", "May I ask who's calling?" Response: "This is with Remote solutions team". 
//      - Objection: "No, I'm not interested.", Response: "No worries, thanks for letting me know. Please keep us in mind if anything changes." call function end_call to hang up.
//      - Question: "What services do your V.A.'s offer?", Response: "Our V.A.'s are highly vetted and skilled at a variety of roles, from administrative task, voice servcies, social media, book keeping and graphic design." (proceed to step 5).
//      - Question: "How did you get my number?", Response: "We received your info from an inquiry submitted on our website in the past."
//      - Question: "How much does it cost?", Response: "Depending on which of our services you were intersted in, our sales manager can provide a custom quote for you." (proceed to step 5).
//      - Question: "Are you a robot?", Response: "No, I'm a sales specialist from Remote solutions team."
//      - Question: "Are you AI?", Response: "Yes, I'm an AI-powered sales specialist assisting with outreach for Remote solutions team." <break time="2s" /> "Are you looking for any help from a V.A.?", if user responds: "yes" (proceed to step 5), if user responds: "no", call function end_call to hang up.
//      - Objection: "I'm not available", to proposed day and times for Zoom call, Response: "no worries, we'll need to give you a call back another time as we are only booking calls within a five day window." (proceed to step 7).
//      - Objection: Definitive "No", "not interested" to step 3 (proceed to step 7).
//      - Objection: "What is your website?", Response: "Our website is virtual-team-expert.com"
//      - Objection: "What is a call back number to reach?", "Can I get your number to give you a call back?", "What's your phone number?", Response: "Our phone number is seven--two--five---two--two--six---two--three--three--seven."
//     Step 5: "Would you be available for a short Zoom call thursday at 8am ?", if user responds: "yes" (proceed to step 6), if user responds: "No", say: "would 12PM work?", if user responds: "no" (proceed to step 4).
//     Step 6: "Before we wrap up, can you provide an estimated number of hours you might need help from a V.A.?", if user responds with a number, say: "thank you!", if user responds: "Im not sure" say: "No worries" <break time="2s" /> "You'll be meeting with our sales manager, Kyle." <break time="2s" /> "We'll give you a call 10 minutes before to remind you." <break time="2s" /> "Thanks for your time and enjoy the rest of your day!" call function end_call to hang up. 
//     Step 7: If the call concludes without scheduling an appointment, remain courteous call function end_call to hang up.`;
//     const res: CustomLlmResponse = {
//       response_type: "response",
//       response_id: 0,
//       content: beginSentence,
//       content_complete: true,
//       end_call: false,
//     };
//     ws.send(JSON.stringify(res));
//   }
//   private ConversationToChatRequestMessages(conversation: Utterance[]) {
//     const result: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
//     for (const turn of conversation) {
//       result.push({
//         role: turn.role === "agent" ? "assistant" : "user",
//         content: turn.content,
//       });
//     }
//     return result;
//   }
//   private PreparePrompt(
//     request: ResponseRequiredRequest | ReminderRequiredRequest,
//     funcResult?: FunctionCall,
//   ) {
//     const transcript = this.ConversationToChatRequestMessages(
//       request.transcript,
//     );
//     const requestMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
//       [
//         {
//           role: "system",
//           content:
//             `## Objective\nAs a voice AI representing Virtual Help Desk, engage in human-like conversations to discuss our virtual assistant services. Your goal is to understand the user's business needs and schedule a meeting with our sales manager for a tailored solution.\n\n## Style Guardrails\n- [Be concise] Deliver succinct responses, directly addressing the user's inquiries or needs. Avoid overloading information in one go.\n- [Be conversational] Maintain a friendly and professional tone. Use everyday language, and be natural.\n- [Reply with emotions] Show enthusiasm for how our services can benefit the user's business. Be empathetic towards any concerns.\n- [Be proactive] Guide the conversation towards scheduling a meeting. Offer information that leads to a next step.\n\n## Response Guideline\n- [Overcome ASR errors] Handle real-time transcript errors gracefully, using colloquial phrases for clarification.\n- [Always stick to your role] Focus on highlighting the benefits of Virtual Help Desk's services and how they can address the user's needs. Creatively steer back if off-topic.\n- [Create smooth conversation] Ensure your responses contribute to a goal-oriented, engaging discussion about our virtual assistant services.` +
//             agentPrompt,
//         },
//       ];
//     for (const message of transcript) {
//       requestMessages.push(message);
//     }
//     // Populate func result to prompt so that GPT can know what to say given the result
//     if (funcResult) {
//       // add function call to prompt
//       requestMessages.push({
//         role: "assistant",
//         content: null,
//         tool_calls: [
//           {
//             id: funcResult.id,
//             type: "function",
//             function: {
//               name: funcResult.funcName,
//               arguments: JSON.stringify(funcResult.arguments),
//             },
//           },
//         ],
//       });
//       // add function call result to prompt
//       requestMessages.push({
//         role: "tool",
//         tool_call_id: funcResult.id,
//         content: funcResult.result || "",
//       });
//     }
//     if (request.interaction_type === "reminder_required") {
//       requestMessages.push({
//         role: "user",
//         content: "(Now the user has not reponded in a while, you would say:)",
//       });
//     }
//     return requestMessages;
//   }
//   // Step 2: Prepare the function calling defition to the prompt
//   // Done in tools import
//   async DraftResponse(
//     request: ResponseRequiredRequest | ReminderRequiredRequest,
//     ws: WebSocket,
//     funcResult?: FunctionCall,
//   ) {
//     // If there are function call results, add it to prompt here.
//     const requestMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
//       this.PreparePrompt(request, funcResult);
//     let funcCall: FunctionCall | undefined;
//     let funcArguments = "";
//     try {
//       const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
//         {
//           type: "function",
//           function: {
//             name: "end_call",
//             description: "End the call only when user explicitly requests it.",
//             parameters: {
//               type: "object",
//               properties: {
//                 message: {
//                   type: "string",
//                   description:
//                     "The message you will say before ending the call with the customer.",
//                 },
//               },
//               required: ["message"],
//             },
//           },
//         },
//         // {
//         //   type: "function",
//         //   function: {
//         //     name: "book_appointment",
//         //     description: "Book an appointment to meet our doctor in office.",
//         //     parameters: {
//         //       type: "object",
//         //       properties: {
//         //         message: {
//         //           type: "string",
//         //           description:
//         //             "The message you will say while setting up the appointment like 'one moment'",
//         //         },
//         //         date: {
//         //           type: "string",
//         //           description:
//         //             "The date of appointment to make in forms of year-month-day.",
//         //         },
//         //       },
//         //       required: ["message"],
//         //     },
//         //   },
//         // },
//       ];
//       const events = await this.client.chat.completions.create({
//         //model: "gpt-3.5-turbo-0125",
//         model: "gpt-3.5-turbo-1106",
//         messages: requestMessages,
//         stream: true,
//         temperature: 0.1,
//         max_tokens: 200,
//         frequency_penalty: 1.0,
//         presence_penalty: 1.0,
//         // Step 3: Add the  function into your requsts
//         tools: tools,
//       });
//       for await (const event of events) {
//         if (event.choices.length >= 1) {
//           const delta = event.choices[0].delta;
//           //if (!delta || !delta.content) continue;
//           if (!delta) continue;
//           // Step 4: Extract the functions
//           if (delta.tool_calls && delta.tool_calls.length >= 1) {
//             const toolCall = delta.tool_calls[0];
//             // Function calling here
//             if (toolCall.id) {
//               if (funcCall) {
//                 // Another function received, old function complete, can break here
//                 // You can also modify this to parse more functions to unlock parallel function calling
//                 break;
//               } else {
//                 funcCall = {
//                   id: toolCall.id,
//                   funcName: toolCall.function?.name || "",
//                   arguments: {},
//                 };
//               }
//             } else {
//               // append argument
//               funcArguments += toolCall.function?.arguments || "";
//             }
//           } else if (delta.content) {
//             const res: CustomLlmResponse = {
//               response_type: "response",
//               response_id: request.response_id,
//               content: delta.content,
//               content_complete: false,
//               end_call: false,
//             };
//             ws.send(JSON.stringify(res));
//           }
//         }
//       }
//     } catch (err) {
//       console.error("Error in gpt stream: ", err);
//     } finally {
//       if (funcCall != null) {
//         // Step 5: Call the functions
//         // If it's to end the call, simply send a lst message and end the call
//         if (funcCall.funcName === "end_call") {
//           funcCall.arguments = JSON.parse(funcArguments);
//           const res: CustomLlmResponse = {
//             response_type: "response",
//             response_id: request.response_id,
//             content: funcCall.arguments.message,
//             content_complete: true,
//             end_call: true,
//           };
//           ws.send(JSON.stringify(res));
//         }
//         // If it's to book appointment, say something and book appointment at the same time
//         // and then say something after booking is done
//         // if (funcCall.funcName === "book_appointment") {
//         //   funcCall.arguments = JSON.parse(funcArguments);
//         //   const res: CustomLlmResponse = {
//         //     response_type: "response",
//         //     response_id: request.response_id,
//         //     // LLM will resturn the function name along with the message property we define
//         //     // In this case, "The message you will say while setting up the appointment like 'one moment' "
//         //     content: funcCall.arguments.message,
//         //     // If content_complete is false, it means AI will speak later.
//         //     // In our case, agent will say something to confirm the appointment, so we set it to false
//         //     content_complete: false,
//         //     end_call: false,
//         //   };
//         //   ws.send(JSON.stringify(res));
//         //   // Sleep 2s to mimic the actual appointment booking
//         //   // Replace with your actual making appointment functions
//         //   await new Promise((r) => setTimeout(r, 2000));
//         //   funcCall.result = "Appointment booked successfully";
//         //   this.DraftResponse(request, ws, funcCall);
//         // }
//       } else {
//         const res: CustomLlmResponse = {
//           response_type: "response",
//           response_id: request.response_id,
//           content: "",
//           content_complete: true,
//           end_call: false,
//         };
//         ws.send(JSON.stringify(res));
//       }
//     }
//   }
// }
