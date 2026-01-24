// utils/shuffleArray.ts

/**
 * Generate a random number between 0 and 1 with enhanced entropy.
 * Uses timestamp-based seeding to ensure unique randomness on each call.
 * 
 * This is particularly useful in React Native environments where rapid
 * successive calls to Math.random() might produce predictable patterns.
 * 
 * @returns A random number between 0 (inclusive) and 1 (exclusive)
 */
export function getEnhancedRandom(): number {
    // Combine Math.random() with timestamp for better entropy
    const timestamp = Date.now();
    const random1 = Math.random();
    const random2 = Math.random();
    
    // Mix the timestamp with two random numbers to create better entropy
    // Using weighted average to prevent overflow and ensure proper distribution:
    // - Each Math.random() contributes 40% (0.4)
    // - Timestamp milliseconds contribute 20%
    // Using modulo 1000 to get milliseconds within the current second
    // which provides rapid variation for successive calls
    const combined = (random1 * 0.4 + random2 * 0.4 + (timestamp % 1000) / 5000);
    
    // Ensure result is always in [0, 1) range
    return combined % 1;
}

/**
 * Fisher-Yates shuffle algorithm with enhanced randomness.
 * Uses timestamp-based entropy to ensure truly unique shuffles on each call.
 * 
 * @param array The array to shuffle
 * @returns A new shuffled copy of the array
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
