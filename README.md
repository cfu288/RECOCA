# RECOCA

RECOCA (REsident Continuity Of Care App) is an an open-source desktop application designed to automate the calculation of commonly used continuity indices, with a focus on residency clinics. Built to be EHR-agnostic and accessible to non-technical users, RECOCA accepts longitudinal appointment data in Excel/CSV format. Users map relevant fields (patient ID, provider ID, appointment date), after which the application calculates four validated continuity metrics: Usual Provider of Care (UPC), Bice-Boxerman Continuity of Care (BB-COC), Modified Modified Continuity Index (MMCI), and Sequential Continuity of Care (SECON). The tool was developed to reduce analytic burden and support routine use in program-level quality improvement efforts.

## Development

Start the application in development mode:

```bash
npm start
```

## Building

Build the application for distribution:

```bash
npm run make
```

## Testing

Run tests:

```bash
npm test
```
