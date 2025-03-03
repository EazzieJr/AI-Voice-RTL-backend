import { format } from "date-fns";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_APIKEY,
});

export const reviewTranscript = async (transcript: string) => {
  try {
    const completion = await client.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        {
          role: "user",
          content: `You are an expert data analyst specializing in sentiment analysis of call transcripts between AI agents and prospects. Your task is to analyze the transcript and accurately categorize the conversation based on the prospect's responses. Use one of the following sentiment analysis categories:

Categories:
positive: The prospect either clearly expresses interest—agreeing to book an appointment or actively discussing next steps—or requests a follow-up, suggesting the agent call back later or follow up in the future.
negative: The prospect explicitly says they are not interested, no longer interested, have found another solution, or expresses disinterest.
neutral: The prospect does not explicitly say they are interested or not interested, or express they are undecided at the moment. 
scheduled: The prospect agrees to scheduling a call, appointment or meeting, chooses one of the provided time slots, or confirms a specific time for an appointment or meeting.
call-back: The prospect request the agent to call back at another time, was busy and not able to talk at that time.
unknown: The call ends abruptly, or the transcription is not clear or has errors making it difficult to accurately categorize the sentiment.
dnc: he prospect is angry and explicitly mentions they never want to be called again, ask to be removed from the list and not receive any calls in the future.

Here is the transcript to analyze: ${transcript}

Instructions:
1. Carefully read and analyze the call transcript provided above.
2. If the transcript is empty or missing, categorize it as 'unknown'.
3. Based on the prospect's responses, assign the most accurate category from the list provided.
4. Respond only with the accurate category name, without any additional explanation or justification.

Output your response in the following format:
<category>Insert category name here</category>`,
        },
      ],
      // model: "gpt-4-turbo-preview",
      model: "gpt-4o-mini", 
    });

    return completion.choices[0];
  } catch (error) {
    console.error("Error analyzing transcript:", error);
    throw new Error("Failed to analyze transcript");
  }
};



export const reviewCallback = async (transcript: string): Promise<string> => {
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
      const nextMonday = new Date(
        currentDate.setDate(
          currentDate.getDate() + ((1 - currentDate.getDay() + 7) % 7 || 7) + 14
        )
      );
      return format(nextMonday, "yyyy-MM-dd");
    }

    // Ensure the date is in the correct format and return it
    return extractedDate;
  } catch (error) {
    console.error("Error analyzing transcript:", error);
    throw new Error("Failed to analyze transcript");
  }
};

