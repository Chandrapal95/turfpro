import { GoogleGenAI } from "@google/genai";
import { Booking } from "../types";

// Initialize Gemini Client
// Using process.env.API_KEY as required by the guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

// Using the correct model for text tasks
const MODEL_NAME = 'gemini-2.5-flash';

export const generateMarketingCopy = async (bookings: Booking[]): Promise<string> => {
  if (!process.env.API_KEY) return "API Key missing. Cannot generate content.";

  const bookingCount = bookings.filter(b => b.Status === 'CONFIRMED').length;
  const prompt = `
    I run a cricket turf business called "TurfPro".
    We have had ${bookingCount} bookings this month.
    Write a short, exciting social media post (max 280 chars) encouraging people to book a slot for this weekend.
    Use emojis. Focus on fitness, fun, and cricket.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });
    return response.text || "Book your slot today!";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error generating content. Please try again.";
  }
};

export const analyzeBusinessInsights = async (bookings: Booking[], totalRevenue: number): Promise<string> => {
    if (!process.env.API_KEY) return "API Key missing.";
    
    // Summarize data to avoid token limits
    const dataSummary = JSON.stringify(bookings.slice(0, 30).map(b => ({ 
      date: b.Date, 
      amount: b.Amount, 
      status: b.Status 
    })));
    
    const prompt = `
      Act as a business analyst. Here is a sample of recent booking data for my cricket turf: ${dataSummary}.
      Total revenue is ${totalRevenue}.
      Provide 3 brief bullet points on business performance and 1 suggestion to improve revenue.
      Keep it professional and concise.
    `;
  
    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
      });
      return response.text || "No insights available.";
    } catch (error) {
      console.error("Gemini API Error:", error);
      return "Could not analyze data.";
    }
  };