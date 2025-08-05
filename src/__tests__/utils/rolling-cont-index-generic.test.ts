import * as pl from "nodejs-polars";
import { calculateRollingContIndexGeneric } from "../../core/continuity/indices/rolling-cont-index-generic";

describe("Rolling Continuity Index - Generic Time Periods", () => {
  const dateStr = (year: number, month: number, day: number) => {
    return `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
  };

  describe("Daily Period Tests", () => {
    test("should calculate daily continuity correctly", () => {
      const df = pl.DataFrame({
        patientId: ["P1", "P1", "P1", "P2", "P2", "P2"],
        provider: ["A", "A", "B", "C", "C", "D"],
        appointment_date: [
          dateStr(2023, 1, 1),   // P1 Day 1
          dateStr(2023, 1, 1),   // P1 Day 1 (same day)
          dateStr(2023, 1, 2),   // P1 Day 2
          dateStr(2023, 1, 1),   // P2 Day 1
          dateStr(2023, 1, 2),   // P2 Day 2
          dateStr(2023, 1, 3),   // P2 Day 3
        ],
      });

      const result = calculateRollingContIndexGeneric(
        df, 
        "provider", 
        ["patientId"], 
        "appointment_date",
        'day'
      );
      
      expect(result.periodType).toBe('day');
      expect(Object.keys(result.periodScores).sort()).toEqual([
        "2023-01-01", 
        "2023-01-02", 
        "2023-01-03"
      ]);
      
      // Day 1: P1 has A->A (1/1 = 1.0)
      expect(result.periodScores["2023-01-01"]).toBe(1.0);
      
      // Day 2: P1 A->B (0), P2 C->C (1) = 1/2 = 0.5
      expect(result.periodScores["2023-01-02"]).toBe(0.5);
      
      // Day 3: P2 C->D (0/1 = 0)
      expect(result.periodScores["2023-01-03"]).toBe(0.0);
      
      // Average: (1.0 + 0.5 + 0.0) / 3 = 0.5
      expect(result.averageScore).toBeCloseTo(0.5, 3);
    });

    test("should handle multiple appointments per day", () => {
      const df = pl.DataFrame({
        patientId: ["P1", "P1", "P1", "P1"],
        provider: ["A", "B", "A", "A"],
        appointment_date: [
          dateStr(2023, 1, 1) + " 09:00",
          dateStr(2023, 1, 1) + " 14:00",
          dateStr(2023, 1, 1) + " 16:00",
          dateStr(2023, 1, 2) + " 10:00",
        ],
      });

      const result = calculateRollingContIndexGeneric(
        df, 
        "provider", 
        ["patientId"], 
        "appointment_date",
        'day'
      );
      
      // Within same day: A->B (0), B->A (0)
      // Across days: A->A (1)
      expect(result.periodScores["2023-01-01"]).toBe(0.0);
      expect(result.periodScores["2023-01-02"]).toBe(1.0);
    });
  });

  describe("Weekly Period Tests", () => {
    test("should calculate weekly continuity correctly", () => {
      const df = pl.DataFrame({
        patientId: ["P1", "P1", "P1", "P2", "P2"],
        provider: ["A", "A", "B", "C", "D"],
        appointment_date: [
          dateStr(2023, 1, 1),   // Week 1 (Sunday)
          dateStr(2023, 1, 5),   // Week 1 (Thursday)
          dateStr(2023, 1, 8),   // Week 2 (Sunday)
          dateStr(2023, 1, 3),   // Week 1 (Tuesday)
          dateStr(2023, 1, 15),  // Week 3 (Sunday)
        ],
      });

      const result = calculateRollingContIndexGeneric(
        df, 
        "provider", 
        ["patientId"], 
        "appointment_date",
        'week'
      );
      
      expect(result.periodType).toBe('week');
      expect(Object.keys(result.periodScores).sort()).toEqual([
        "week-1", 
        "week-2", 
        "week-3"
      ]);
      
      // Week 1: P1 has A->A (1/1 = 1.0)
      expect(result.periodScores["week-1"]).toBe(1.0);
      
      // Week 2: P1 A->B (0/1 = 0)
      expect(result.periodScores["week-2"]).toBe(0.0);
      
      // Week 3: P2 C->D (0/1 = 0)
      expect(result.periodScores["week-3"]).toBe(0.0);
    });

    test("should handle appointments spanning multiple weeks", () => {
      const df = pl.DataFrame({
        patientId: Array(8).fill("P1"),
        provider: ["A", "A", "B", "B", "C", "C", "A", "A"],
        appointment_date: [
          dateStr(2023, 1, 1),   // Week 1
          dateStr(2023, 1, 7),   // Week 1
          dateStr(2023, 1, 8),   // Week 2
          dateStr(2023, 1, 14),  // Week 2
          dateStr(2023, 1, 15),  // Week 3
          dateStr(2023, 1, 21),  // Week 3
          dateStr(2023, 1, 22),  // Week 4
          dateStr(2023, 1, 28),  // Week 4
        ],
      });

      const result = calculateRollingContIndexGeneric(
        df, 
        "provider", 
        ["patientId"], 
        "appointment_date",
        'week'
      );
      
      // Week 1: A->A (1/1 = 1.0)
      expect(result.periodScores["week-1"]).toBe(1.0);
      
      // Week 2: A->B (0), B->B (1) = 1/2 = 0.5
      expect(result.periodScores["week-2"]).toBe(0.5);
      
      // Week 3: B->C (0), C->C (1) = 1/2 = 0.5
      expect(result.periodScores["week-3"]).toBe(0.5);
      
      // Week 4: C->A (0), A->A (1) = 1/2 = 0.5
      expect(result.periodScores["week-4"]).toBe(0.5);
    });
  });

  describe("Custom Period Tests", () => {
    test("should calculate custom 10-day period continuity", () => {
      const df = pl.DataFrame({
        patientId: ["P1", "P1", "P1", "P2", "P2"],
        provider: ["A", "A", "B", "C", "C"],
        appointment_date: [
          dateStr(2023, 1, 1),   // Period 1 (days 1-10)
          dateStr(2023, 1, 9),   // Period 1
          dateStr(2023, 1, 11),  // Period 2 (days 11-20)
          dateStr(2023, 1, 5),   // Period 1
          dateStr(2023, 1, 25),  // Period 3 (days 21-30)
        ],
      });

      const result = calculateRollingContIndexGeneric(
        df, 
        "provider", 
        ["patientId"], 
        "appointment_date",
        'custom',
        10  // 10-day periods
      );
      
      expect(result.periodType).toBe('custom');
      expect(Object.keys(result.periodScores).sort()).toEqual([
        "period-1", 
        "period-2", 
        "period-3"
      ]);
      
      // Period 1: P1 has A->A (1/1 = 1.0)
      expect(result.periodScores["period-1"]).toBe(1.0);
      
      // Period 2: P1 A->B (0/1 = 0)
      expect(result.periodScores["period-2"]).toBe(0.0);
      
      // Period 3: P2 C->C (1/1 = 1.0)
      expect(result.periodScores["period-3"]).toBe(1.0);
    });

    test("should handle custom 3-day periods", () => {
      const df = pl.DataFrame({
        patientId: Array(6).fill("P1"),
        provider: ["A", "A", "B", "B", "A", "A"],
        appointment_date: [
          dateStr(2023, 1, 1),   // Period 1 (days 1-3)
          dateStr(2023, 1, 3),   // Period 1
          dateStr(2023, 1, 4),   // Period 2 (days 4-6)
          dateStr(2023, 1, 6),   // Period 2
          dateStr(2023, 1, 7),   // Period 3 (days 7-9)
          dateStr(2023, 1, 9),   // Period 3
        ],
      });

      const result = calculateRollingContIndexGeneric(
        df, 
        "provider", 
        ["patientId"], 
        "appointment_date",
        'custom',
        3  // 3-day periods
      );
      
      // Period 1: A->A (1/1 = 1.0)
      expect(result.periodScores["period-1"]).toBe(1.0);
      
      // Period 2: A->B (0), B->B (1) = 1/2 = 0.5
      expect(result.periodScores["period-2"]).toBe(0.5);
      
      // Period 3: B->A (0), A->A (1) = 1/2 = 0.5
      expect(result.periodScores["period-3"]).toBe(0.5);
    });

    test("should error when custom period days not specified", () => {
      const df = pl.DataFrame({
        patientId: ["P1", "P1"],
        provider: ["A", "B"],
        appointment_date: [dateStr(2023, 1, 1), dateStr(2023, 1, 5)],
      });

      const result = calculateRollingContIndexGeneric(
        df, 
        "provider", 
        ["patientId"], 
        "appointment_date",
        'custom'
        // Missing customPeriodDays parameter
      );
      
      expect(Object.keys(result.periodScores).length).toBe(0);
      expect(result.averageScore).toBeUndefined();
    });
  });

  describe("Edge Cases", () => {
    test("should handle same timestamp appointments correctly for daily periods", () => {
      const df = pl.DataFrame({
        patientId: ["P1", "P1", "P2", "P2"],
        provider: ["A", "B", "C", "C"],
        appointment_date: [
          "2023-01-01 10:00:00",
          "2023-01-01 10:00:00",  // Same exact timestamp
          "2023-01-01 14:00:00",
          "2023-01-01 14:00:00",  // Same exact timestamp
        ],
      });

      const result = calculateRollingContIndexGeneric(
        df, 
        "provider", 
        ["patientId"], 
        "appointment_date",
        'day'
      );
      
      // Both transitions happen on same day
      // P1: A->B (0), P2: C->C (1) = 1/2 = 0.5
      expect(result.periodScores["2023-01-01"]).toBe(0.5);
    });

    test("should handle year transitions for weekly periods", () => {
      const df = pl.DataFrame({
        patientId: ["P1", "P1", "P1"],
        provider: ["A", "A", "B"],
        appointment_date: [
          dateStr(2022, 12, 26),  // Week starting from this date
          dateStr(2023, 1, 2),    // Week 2 (7 days later)
          dateStr(2023, 1, 9),    // Week 3
        ],
      });

      const result = calculateRollingContIndexGeneric(
        df, 
        "provider", 
        ["patientId"], 
        "appointment_date",
        'week'
      );
      
      // Only weeks with transitions are included
      expect(Object.keys(result.periodScores)).toHaveLength(2);
      expect(result.periodScores["week-2"]).toBe(1.0); // A->A
      expect(result.periodScores["week-3"]).toBe(0.0); // A->B
    });

    test("should maintain backward compatibility with monthly calculations", () => {
      const df = pl.DataFrame({
        patientId: ["P1", "P1", "P2", "P2"],
        provider: ["A", "A", "B", "C"],
        appointment_date: [
          dateStr(2023, 1, 15),
          dateStr(2023, 2, 20),
          dateStr(2023, 1, 10),
          dateStr(2023, 2, 25),
        ],
      });

      const result = calculateRollingContIndexGeneric(
        df, 
        "provider", 
        ["patientId"], 
        "appointment_date",
        'month'
      );
      
      expect(result.periodType).toBe('month');
      expect(result.periodScores["2023-02"]).toBe(0.5); // P1: A->A (1), P2: B->C (0)
    });
  });

  describe("Performance Tests", () => {
    test("should handle large dataset with daily periods efficiently", () => {
      const largeData: { 
        patientId: string[]; 
        provider: string[]; 
        appointment_date: string[] 
      } = {
        patientId: [],
        provider: [],
        appointment_date: [],
      };

      // Create 100 patients with appointments over 30 days
      for (let patientNum = 1; patientNum <= 100; patientNum++) {
        const patientId = `P${patientNum.toString().padStart(3, "0")}`;
        const appointmentCount = 5 + (patientNum % 6);
        
        for (let i = 0; i < appointmentCount; i++) {
          largeData.patientId.push(patientId);
          largeData.provider.push(i % 3 === 0 ? "Dr_B" : "Dr_A");
          largeData.appointment_date.push(dateStr(2023, 1, 1 + (i * 5) % 30));
        }
      }

      const largeDf = pl.DataFrame(largeData);

      const startTime = Date.now();
      const result = calculateRollingContIndexGeneric(
        largeDf, 
        "provider", 
        ["patientId"], 
        "appointment_date",
        'day'
      );
      const endTime = Date.now();

      // Should complete within 2 seconds
      expect(endTime - startTime).toBeLessThan(2000);
      expect(Object.keys(result.periodScores).length).toBeGreaterThan(0);
      expect(result.averageScore).toBeDefined();
    });
  });
});