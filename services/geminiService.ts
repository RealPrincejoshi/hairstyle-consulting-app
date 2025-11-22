import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult } from "../types";

// Initialize Gemini Client
// Note: process.env.API_KEY is injected by the runtime environment.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Model Constants
const ANALYSIS_MODEL = "gemini-2.5-flash";
const GENERATION_MODEL = "gemini-2.5-flash-image"; 

const analysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    faceShape: {
      type: Type.STRING,
      description: "The identified shape of the face (e.g., Oval, Square, Heart, Round, Diamond, Oblong).",
    },
    suggestions: {
      type: Type.ARRAY,
      description: "Exactly five hairstyle suggestions.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Name of the hairstyle." },
          description: { type: Type.STRING, description: "Brief visual description of the hairstyle." },
          reasoning: { type: Type.STRING, description: "Why this suits the face shape based on the provided angles." },
        },
        required: ["name", "description", "reasoning"],
      },
    },
  },
  required: ["faceShape", "suggestions"],
};

/**
 * Analyzes the face in the provided base64 image strings (Front, Left, Right).
 */
export const analyzeFace = async (base64Images: string[]): Promise<AnalysisResult> => {
  try {
    const parts = base64Images.map(img => ({
      inlineData: {
        mimeType: "image/jpeg",
        data: img.replace(/^data:image\/(png|jpeg|jpg);base64,/, ""),
      }
    }));

    const response = await ai.models.generateContent({
      model: ANALYSIS_MODEL,
      contents: {
        parts: [
          ...parts,
          {
            text: "Analyze the face in these images. You are provided with 3 angles: 1. Front View, 2. Left Profile (or partial turn), 3. Right Profile (or partial turn). Use all angles to accurately identify the face shape. Suggest exactly 5 distinct, trendy hairstyles that would perfectly suit this person's face shape and features. Focus on realistic, achievable styles. Provide variety (short, medium, long if applicable).",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
        temperature: 0.5,
      },
    });

    if (!response.text) {
      throw new Error("No analysis generated.");
    }

    return JSON.parse(response.text) as AnalysisResult;
  } catch (error) {
    console.error("Analysis Error:", error);
    throw error;
  }
};

/**
 * Generates a visualization of a specific hairstyle on the user's photo.
 */
export const generateHairstyleImage = async (
  base64Image: string,
  hairstyleName: string,
  hairstyleDescription: string
): Promise<string> => {
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

  const prompt = `
    Transform this image: The person in the photo is now wearing a ${hairstyleName}.
    ${hairstyleDescription}.
    CRITICAL: Keep the person's facial features, expression, skin tone, and head pose EXACTLY the same as the original image. 
    Only change the hair. High quality, photorealistic portrait.
  `;

  try {
    const response = await ai.models.generateContent({
      model: GENERATION_MODEL,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: cleanBase64,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
        // Image generation config
      },
    });

    // Extract image from response
    const parts = response.candidates?.[0]?.content?.parts;
    if (!parts) throw new Error("No content in response");

    // Iterate to find the inlineData (image)
    for (const part of parts) {
      if (part.inlineData && part.inlineData.data) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }

    throw new Error("No image generated in response.");
  } catch (error) {
    console.error(`Generation Error for ${hairstyleName}:`, error);
    throw error; // Re-throw to handle in UI
  }
};