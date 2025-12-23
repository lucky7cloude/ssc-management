
import { GoogleGenAI } from "@google/genai";
import { Teacher, ScheduleEntry } from "../types";

// Always initialize the client using the API key from environment variables.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- FIX: Changed schedule type to any[] to support accessing metadata properties like day, periodIndex, and classId ---
export const analyzeWorkload = async (teachers: Teacher[], schedule: any[]) => {
    try {
        // Prepare a concise data summary for the AI
        const dataSummary = {
            teacherCount: teachers.length,
            teachers: teachers.map(t => ({ id: t.id, name: t.name })),
            scheduleCount: schedule.length,
            scheduleSample: schedule.slice(0, 50).map(s => ({ // Send partial schedule to avoid token limits if massive
                teacherId: s.teacherId,
                day: s.day,
                period: s.periodIndex,
                classId: s.classId,
                subject: s.subject
            }))
        };

        const prompt = `
            You are an expert School Administrator Consultant for Silver Star Convent School.
            I will provide you with data about our teachers and schedule. 
            
            Data Summary: ${JSON.stringify(dataSummary)}

            Please generate a **Comprehensive School Management Report** in structured HTML format (use <div>, <h3>, <ul>, <li>, <p> tags, use Tailwind classes for basic styling like 'text-brand-600', 'font-bold').
            
            The report should cover point-by-point:
            
            1.  **Workload Analysis**: Identify teachers who are overloaded (teaching too many consecutive periods) vs. underutilized.
            2.  **Resource Optimization**: Suggestions on how to better distribute classes.
            3.  **Substitution Strategy**: General advice on how to handle the current schedule's density when teachers are absent.
            4.  **Operational Efficiency**: 3 Key actionable tips for the principal to improve school timing or management.
            
            Keep the tone professional, encouraging, and highly actionable. Do not output markdown backticks, just raw HTML.
        `;

        // Use 'gemini-3-flash-preview' for general text analysis tasks as per guidelines.
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });

        // Use the .text property to extract the generated response.
        return response.text;
    } catch (error) {
        console.error("Gemini Analysis Error:", error);
        return `
            <div class="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                <h3 class="font-bold">Analysis Unavailable</h3>
                <p>Unable to generate the report at this time. Please check your internet connection or API key configuration.</p>
            </div>
        `;
    }
};
