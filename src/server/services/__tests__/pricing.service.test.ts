import { describe, it, expect } from 'vitest';
import { pricingService } from '../pricing.service';

describe('pricingService', () => {
    describe('calculatePrice', () => {
        it('should calculate price correctly for standard shipment', async () => {
            const input = {
                origin: { lat: 48.8566, lng: 2.3522 }, // Paris
                destination: { lat: 45.7640, lng: 4.8357 }, // Lyon (~400km)
                package: { length: 30, width: 30, height: 30, weight: 5 }, // 5kg
                speed: 'STANDARD'
            };

            const result = await pricingService.calculatePrice(input as any);
            
            // Expected validation logic
            expect(result.distance.km).toBeGreaterThan(300);
            expect(result.breakdown.total).toBeGreaterThan(0);
            expect(result.breakdown).toBeDefined();
        });

        it('should apply express surcharge', async () => {
            const baseInput = {
                origin: { lat: 0, lng: 0 },
                destination: { lat: 0, lng: 1 }, // Some distance
                package: { length: 1, width: 1, height: 1, weight: 1 },
                speed: 'STANDARD'
            };

            const standardPrice = await pricingService.calculatePrice({ ...baseInput, speed: 'STANDARD' } as any);
            const expressPrice = await pricingService.calculatePrice({ ...baseInput, speed: 'EXPRESS' } as any);

            expect(expressPrice.breakdown.total).toBeGreaterThan(standardPrice.breakdown.total);
        });
    });
});
