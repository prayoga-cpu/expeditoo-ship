/**
 * OpenAI Client Configuration
 * Uses GPT-4o-mini for cost-effective AI processing
 * 
 * Pricing:
 * - gpt-4o-mini: $0.15 / 1M input tokens, $0.60 / 1M output tokens
 */

import OpenAI from "openai";

const API_KEY = process.env.OPENAI_API_KEY || "";

// Initialize client - will be null if no API key
const openai = API_KEY ? new OpenAI({ apiKey: API_KEY }) : null;

/**
 * Check if OpenAI is available (API key configured)
 */
export function isOpenAIAvailable(): boolean {
    return !!openai;
}

/**
 * Get the OpenAI client
 */
export function getOpenAIClient(): OpenAI | null {
    return openai;
}

/**
 * Convert image URL to base64 data URL for OpenAI Vision
 */
export async function imageUrlToBase64DataUrl(url: string): Promise<string | null> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error("Failed to fetch image:", url);
            return null;
        }

        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        const contentType = response.headers.get("content-type") || "image/jpeg";

        return `data:${contentType};base64,${base64}`;
    } catch (error) {
        console.error("Error converting image to base64:", error);
        return null;
    }
}

export { openai };
