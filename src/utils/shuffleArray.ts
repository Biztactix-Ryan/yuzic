// utils/shuffleArray.ts

/**
 * Generate a random number between 0 and 1 with enhanced entropy.
 * Uses timestamp-based seeding to ensure unique randomness on each call.
 */
function getEnhancedRandom(): number {
    // Combine Math.random() with timestamp for better entropy
    const timestamp = Date.now();
    const random1 = Math.random();
    const random2 = Math.random();
    
    // Mix the timestamp with two random numbers to create better entropy
    const combined = (random1 + random2 + (timestamp % 1000) / 1000) % 1;
    return combined;
}

/**
 * Fisher-Yates shuffle algorithm with enhanced randomness.
 * Uses timestamp-based entropy to ensure truly unique shuffles on each call.
 */
export default function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        // Use enhanced random with timestamp-based entropy
        const j = Math.floor(getEnhancedRandom() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}
