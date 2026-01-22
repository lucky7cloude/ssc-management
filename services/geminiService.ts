
import { GoogleGenAI, Type } from "@google/genai";
import { Teacher, ScheduleEntry, DAYS, PERIODS, ClassSection } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateWeeklyTimetable = async (teachers: Teacher[], classes: ClassSection[]) => {
    try {
        const prompt = `
            You are an expert school administrator. Generate a weekly base timetable for "Silver Star Convent School".
            Teachers: ${JSON.stringify(teachers.map(t => ({ id: t.id, name: t.name, subjects: t.subjectsTaught || [] })))}
            Classes: ${JSON.stringify(classes.map(c => ({ id: c.id, name: c.name })))}
            Days: ${JSON.stringify(DAYS)}
            Periods: 7 total (indices 0, 1, 2, 4, 5, 6 are teaching periods, index 3 is LUNCH).

            Rules:
            1. No teacher can be in two classes in the same period.
            2. Assign teachers to classes they are experts in (check their subjects).
            3. Ensure a balanced distribution of subjects.
            4. Monday to Saturday must be filled.
            
            Return ONLY a JSON object where keys are days (e.g., "Monday") and values are maps of "classId_periodIndex" to { teacherId, subject }.
            Example: {"Monday": {"c6_0": {"teacherId": "t1", "subject": "Math"}}}
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json"
            }
        });

        return JSON.parse(response.text);
    } catch (error) {
        console.error("AI Timetable Generation Error:", error);
        throw error;
    }
};

export const analyzeWorkload = async (teachers: Teacher[], schedule: any[]) => {
    try {
        const dataSummary = {
            teacherCount: teachers.length,
            teachers: teachers.map(t => ({ id: t.id, name: t.name })),
            scheduleCount: schedule.length,
            scheduleSample: schedule.slice(0, 50).map(s => ({ 
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

            Please generate a **Comprehensive School Management Report** in structured HTML format.
            Use Tailwind classes for styling (e.g., 'text-brand-600', 'font-bold').
            
            The report should cover:
            1. Workload Analysis (identify overloaded/underutilized staff).
            2. Resource Optimization tips.
            3. Operational Efficiency (3 actionable tips).
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });

        return response.text;
    } catch (error) {
        console.error("Gemini Analysis Error:", error);
        return `<div class="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">Analysis Unavailable</div>`;
    }
};
