
/**
 * AI features implementation using Gemini API.
 */
import { GoogleGenAI } from "@google/genai";
import { Teacher, ClassSection } from "../types";

// Initialize the Google GenAI client with API key from environment
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Fix: Implement AI Timetable Generation using Gemini 3 Pro
export const generateWeeklyTimetable = async (teachers: Teacher[], classes: ClassSection[]) => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `Generate a sample school weekly timetable for the following teachers: ${JSON.stringify(teachers)} and classes: ${JSON.stringify(classes)}.
            There are 7 periods (indices 0 to 6). Period 3 is lunch.
            Return a JSON object where keys are in the format "classId_periodIndex" and values are { "teacherId": "string", "subject": "string" }.
            Ensure reasonable distribution of subjects and respect teacher availability.`,
            config: {
                responseMimeType: "application/json"
            }
        });

        const text = response.text || '{}';
        return JSON.parse(text);
    } catch (e) {
        console.error("Timetable generation failed:", e);
        return {};
    }
};

// Fix: Implement Workload Analysis using Gemini 3 Flash
export const analyzeWorkload = async (teachers: Teacher[], schedule: any) => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Analyze teacher workload and potential burnout risk based on the following:
            Teachers: ${JSON.stringify(teachers)}
            Schedule Data: ${JSON.stringify(schedule)}
            Identify teachers with the most periods and suggest better distribution. 
            Return the result as a clean HTML snippet inside a <div>.`,
        });

        return response.text || `<div class="p-4 bg-slate-50 border border-slate-200 rounded-lg text-slate-700">Analysis results unavailable.</div>`;
    } catch (e) {
        console.error("Workload analysis failed:", e);
        return `<div class="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">Error: AI diagnostics could not be performed.</div>`;
    }
};
