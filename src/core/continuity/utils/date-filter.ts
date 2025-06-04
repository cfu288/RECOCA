import * as pl from "nodejs-polars";

/**
 * Parse various Excel date formats into a JavaScript Date object.
 * Handles formats: M/D/YY, MM/DD/YYYY, YYYY-MM-DD, DD-MMM-YYYY,
 * ISO format (YYYY-MM-DDThh:mm:ss), and Excel serial numbers
 *
 * @param dateStr - The date string or Excel serial number to parse
 * @returns A JavaScript Date object or null if parsing fails
 */
export function parseExcelDateString(
  dateStr: string | number | null | undefined
): Date | null {
  if (dateStr === null || dateStr === undefined || dateStr === "") {
    return null;
  }

  try {
    let isExcelSerial = false;
    let excelSerialNumber: number | null = null;

    if (typeof dateStr === "number") {
      isExcelSerial = true;
      excelSerialNumber = dateStr;
    } else if (
      typeof dateStr === "string" &&
      !isNaN(Number(dateStr)) &&
      !dateStr.includes("/") &&
      !dateStr.includes("-") &&
      !dateStr.includes(".")
    ) {
      isExcelSerial = true;
      excelSerialNumber = Number(dateStr);
    }

    if (isExcelSerial && excelSerialNumber !== null) {
      // Excel serial numbers typically start from January 0, 1900
      // and have a bug where 1900 is incorrectly treated as a leap year
      if (excelSerialNumber < 1 || excelSerialNumber > 100000) {
        return null; // Unreasonable Excel date value
      }

      // Convert Excel serial number to date
      // Excel counts from January 1, 1900 (using 1 as the first day)
      const baseDate = new Date(Date.UTC(1899, 11, 30));

      // Excel has a leap year bug where it incorrectly treats 1900 as a leap year
      // We need to adjust dates after February 28, 1900 (excel serial > 59)
      const adjustedDays =
        excelSerialNumber > 59 ? excelSerialNumber - 1 : excelSerialNumber;
      const msFromBaseDate = adjustedDays * 24 * 60 * 60 * 1000;
      const date = new Date(baseDate.getTime() + msFromBaseDate);
      return date;
    }

    const dateStrValue = String(dateStr);

    // Try various date formats

    // 1. M/D/YY or MM/DD/YYYY format
    if (dateStrValue.includes("/")) {
      const parts = dateStrValue.split("/");
      if (parts.length === 3) {
        const month = parseInt(parts[0], 10);
        const day = parseInt(parts[1], 10);
        let year = parseInt(parts[2], 10);

        // Validate month and day
        if (month < 1 || month > 12 || day < 1 || day > 31) {
          return null;
        }

        // If year is 2 digits, convert to 4 digits
        // Assume 00-99 is 2000-2099
        if (year < 100) {
          year = year < 50 ? 2000 + year : 1900 + year;
        }

        // Create Date (month is 0-indexed in JavaScript)
        const date = new Date(year, month - 1, day);

        // Check if date is valid (e.g., not Feb 30)
        if (
          date.getFullYear() !== year ||
          date.getMonth() !== month - 1 ||
          date.getDate() !== day
        ) {
          return null;
        }

        return date;
      }
    }

    // 2. YYYY-MM-DD or ISO format
    if (dateStrValue.includes("-")) {
      // Check for ISO format with time component (e.g. 2022-01-15T00:00:00)
      if (dateStrValue.includes("T")) {
        const date = new Date(dateStrValue);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }

      // Check for YYYY-MM-DD format explicitly
      const dateRegex = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
      const match = dateStrValue.match(dateRegex);

      if (match) {
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10);
        const day = parseInt(match[3], 10);

        // Validate year, month and day
        if (
          isNaN(year) ||
          isNaN(month) ||
          isNaN(day) ||
          month < 1 ||
          month > 12 ||
          day < 1 ||
          day > 31
        ) {
          return null;
        }

        // Create Date (month is 0-indexed in JavaScript)
        const date = new Date(year, month - 1, day);

        // Check if date is valid (e.g., not Feb 30)
        if (
          date.getFullYear() !== year ||
          date.getMonth() !== month - 1 ||
          date.getDate() !== day
        ) {
          return null;
        }

        return date;
      }

      // 3. DD-MMM-YYYY format (e.g., 15-Jan-2022)
      const monthFormatRegex = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/;
      const monthMatch = dateStrValue.match(monthFormatRegex);

      if (monthMatch) {
        const day = parseInt(monthMatch[1], 10);
        const monthStr = monthMatch[2].toLowerCase();
        const year = parseInt(monthMatch[3], 10);

        // Map month names to month numbers (0-indexed)
        const monthMap: Record<string, number> = {
          jan: 0,
          feb: 1,
          mar: 2,
          apr: 3,
          may: 4,
          jun: 5,
          jul: 6,
          aug: 7,
          sep: 8,
          oct: 9,
          nov: 10,
          dec: 11,
        };

        const month = monthMap[monthStr.substring(0, 3).toLowerCase()];

        // Validate components
        if (
          isNaN(day) ||
          month === undefined ||
          isNaN(year) ||
          day < 1 ||
          day > 31
        ) {
          return null;
        }

        // Create Date
        const date = new Date(year, month, day);

        // Check if date is valid (e.g., not Feb 30)
        if (
          date.getFullYear() !== year ||
          date.getMonth() !== month ||
          date.getDate() !== day
        ) {
          return null;
        }

        return date;
      }
    }

    // 4. Try handling dates with dot separator (e.g., DD.MM.YYYY or MM.DD.YYYY)
    if (dateStrValue.includes(".")) {
      const parts = dateStrValue.split(".");
      if (parts.length === 3) {
        // Assume MM.DD.YYYY format (common in US Excel exports)
        const month = parseInt(parts[0], 10);
        const day = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);

        // Validate month and day
        if (month < 1 || month > 12 || day < 1 || day > 31) {
          return null;
        }

        // Create Date (month is 0-indexed in JavaScript)
        const date = new Date(year, month - 1, day);

        // Check if date is valid (e.g., not Feb 30)
        if (
          date.getFullYear() !== year ||
          date.getMonth() !== month - 1 ||
          date.getDate() !== day
        ) {
          return null;
        }

        return date;
      }
    }

    // 5. Last resort - attempt to use JavaScript's built-in date parsing
    const date = new Date(dateStrValue);
    if (!isNaN(date.getTime())) {
      // Additional validation - sometimes JavaScript will parse invalid formats
      // Check if input is something like "15/Jan/2022" - a format we want to reject
      if (dateStrValue.includes("/") && dateStrValue.match(/[a-zA-Z]/)) {
        return null;
      }
      return date;
    }

    // If all parsing attempts fail, return null
    return null;
  } catch (error) {
    // If any parsing error occurs, return null
    return null;
  }
}

/**
 * Filter a Polars DataFrame by a date range on a specified column.
 * Both the start date and end date are inclusive.
 * When start and end dates are the same, returns all records for that specific day.
 *
 * @param df - The Polars DataFrame to filter
 * @param dateColumnName - The name of the column containing date strings
 * @param startDateStr - Start date string in YYYY-MM-DD format (inclusive)
 * @param endDateStr - End date string in YYYY-MM-DD format (inclusive)
 * @returns A new filtered DataFrame
 */
export function filterDataFrameByDateRange(
  df: pl.DataFrame,
  dateColumnName: string,
  startDateStr: string,
  endDateStr: string
): pl.DataFrame {
  // Validate inputs
  if (!dateColumnName || !startDateStr || !endDateStr) {
    return df.clone();
  }

  try {
    if (!df.columns.includes(dateColumnName)) {
      console.warn(`Column "${dateColumnName}" not found in DataFrame`);
      return df.clone();
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      console.warn(
        `Invalid date format: start="${startDateStr}", end="${endDateStr}"`
      );
      return df.clone();
    }

    // If the input is in ISO format (YYYY-MM-DD), convert to local date to match parseExcelDateString behavior
    let normalizedStartDate = startDate;
    let normalizedEndDate = endDate;

    if (startDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const parts = startDateStr.split("-");
      normalizedStartDate = new Date(
        parseInt(parts[0]),
        parseInt(parts[1]) - 1,
        parseInt(parts[2])
      );
    }

    if (endDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const parts = endDateStr.split("-");
      normalizedEndDate = new Date(
        parseInt(parts[0]),
        parseInt(parts[1]) - 1,
        parseInt(parts[2])
      );
    }

    // Normalize dates to start of day for consistent comparison
    normalizedStartDate.setHours(0, 0, 0, 0);
    normalizedEndDate.setHours(0, 0, 0, 0);

    // For inclusive end date, we need to set the end date to end of day
    const endDateForComparison = new Date(normalizedEndDate);
    endDateForComparison.setHours(23, 59, 59, 999);

    const dateColumn = df.getColumn(dateColumnName).toArray();

    const rows: boolean[] = [];

    for (let i = 0; i < df.height; i++) {
      const dateValue = dateColumn[i];

      const date = parseExcelDateString(dateValue);

      if (date === null) {
        rows.push(false); // Exclude invalid dates
        continue;
      }

      // Normalize the parsed date to start of day for consistent comparison
      const normalizedDate = new Date(date);
      normalizedDate.setHours(0, 0, 0, 0);

      // Check if date is within the range (inclusive start, inclusive end)
      const isInRange =
        normalizedDate >= normalizedStartDate &&
        normalizedDate <= endDateForComparison;
      rows.push(isInRange);
    }

    return df.filter(pl.Series("mask", rows));
  } catch (error) {
    console.error("Error filtering DataFrame by date range:", error);
    return df.clone();
  }
}
