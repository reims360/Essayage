/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";

const fileToPart = async (file: File) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
    const { mimeType, data } = dataUrlToParts(dataUrl);
    return { inlineData: { mimeType, data } };
};

const dataUrlToParts = (dataUrl: string) => {
    const arr = dataUrl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");
    return { mimeType: mimeMatch[1], data: arr[1] };
}

const dataUrlToPart = (dataUrl: string) => {
    const { mimeType, data } = dataUrlToParts(dataUrl);
    return { inlineData: { mimeType, data } };
}

const handleApiResponse = (response: GenerateContentResponse): string => {
    if (response.promptFeedback?.blockReason) {
        const { blockReason, blockReasonMessage } = response.promptFeedback;
        const errorMessage = `La requête a été bloquée. Raison : ${blockReason}. ${blockReasonMessage || ''}`;
        throw new Error(errorMessage);
    }

    // Find the first image part in any candidate
    for (const candidate of response.candidates ?? []) {
        const imagePart = candidate.content?.parts?.find(part => part.inlineData);
        if (imagePart?.inlineData) {
            const { mimeType, data } = imagePart.inlineData;
            return `data:${mimeType};base64,${data}`;
        }
    }

    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
        const errorMessage = `La génération d'image s'est arrêtée de manière inattendue. Raison : ${finishReason}. Cela est souvent lié aux paramètres de sécurité.`;
        throw new Error(errorMessage);
    }
    const textFeedback = response.text?.trim();
    const errorMessage = `Le modèle IA n'a pas retourné d'image. ` + (textFeedback ? `Le modèle a répondu avec le texte : "${textFeedback}"` : "Cela peut se produire à cause des filtres de sécurité ou si la requête est trop complexe. Veuillez essayer une autre image.");
    throw new Error(errorMessage);
};

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
const model = 'gemini-2.5-flash-image';

export const generateModelImage = async (userImage: File): Promise<string> => {
    const userImagePart = await fileToPart(userImage);
    const prompt = "Vous êtes une IA experte en photographie de mode. Transformez la personne sur cette image en une photo de mannequin de mode en pied, adaptée à un site de e-commerce. L'arrière-plan doit être un fond de studio neutre et épuré (gris clair, #f0f0f0). La personne doit avoir une expression neutre et professionnelle de mannequin. Préservez l'identité, les caractéristiques uniques et la morphologie de la personne, mais placez-la dans une pose de mannequin standard, debout et détendue. L'image finale doit être photoréaliste. Retournez UNIQUEMENT l'image finale.";
    const response = await ai.models.generateContent({
        model,
        contents: { parts: [userImagePart, { text: prompt }] },
    });
    return handleApiResponse(response);
};

export const generateVirtualTryOnImage = async (modelImageUrl: string, garmentImage: File): Promise<string> => {
    const modelImagePart = dataUrlToPart(modelImageUrl);
    const garmentImagePart = await fileToPart(garmentImage);
    const prompt = `Vous êtes une IA experte en essayage virtuel. Vous recevrez une 'image de mannequin' et une 'image de vêtement'. Votre tâche est de créer une nouvelle image photoréaliste où la personne de l' 'image de mannequin' porte le vêtement de l' 'image de vêtement'.

**Règles cruciales :**
1.  **Remplacement complet du vêtement :** Vous DEVEZ complètement RETIRER et REMPLACER le vêtement porté par la personne dans l' 'image de mannequin' par le nouveau vêtement. Aucune partie du vêtement d'origine (par exemple, cols, manches, motifs) ne doit être visible dans l'image finale.
2.  **Préserver le mannequin :** Le visage, les cheveux, la silhouette et la pose de la personne de l' 'image de mannequin' DOIVENT rester inchangés.
3.  **Préserver l'arrière-plan :** L'intégralité de l'arrière-plan de l' 'image de mannequin' DOIT être parfaitement préservée.
4.  **Appliquer le vêtement :** Ajustez de manière réaliste le nouveau vêtement sur la personne. Il doit s'adapter à sa pose avec des plis, des ombres et un éclairage naturels, cohérents avec la scène originale.
5.  **Sortie :** Retournez UNIQUEMENT l'image finale, éditée. N'incluez aucun texte.`;
    const response = await ai.models.generateContent({
        model,
        contents: { parts: [modelImagePart, garmentImagePart, { text: prompt }] },
    });
    return handleApiResponse(response);
};

export const generatePoseVariation = async (tryOnImageUrl: string, poseInstruction: string): Promise<string> => {
    const tryOnImagePart = dataUrlToPart(tryOnImageUrl);
    const prompt = `Vous êtes une IA experte en photographie de mode. Prenez cette image et régénérez-la sous une perspective différente. La personne, les vêtements et le style de l'arrière-plan doivent rester identiques. La nouvelle perspective doit être : "${poseInstruction}". Retournez UNIQUEMENT l'image finale.`;
    const response = await ai.models.generateContent({
        model,
        contents: { parts: [tryOnImagePart, { text: prompt }] },
    });
    return handleApiResponse(response);
};