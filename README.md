# RECOCA

RECOCA (REsident Continuity Of Care App) is an open-source desktop application designed to automate the calculation of commonly used continuity indices, with a focus on residency clinics. Built to be EHR-agnostic and accessible to non-technical users, RECOCA accepts longitudinal appointment data in Excel/CSV format. Users map relevant fields (patient ID, provider ID, appointment date), after which the application calculates four validated continuity metrics: Usual Provider of Care (UPC), Bice-Boxerman Continuity of Care (BB-COC), Modified Modified Continuity Index (MMCI), and Sequential Continuity of Care (SECON). The tool was developed to reduce analytic burden and support routine use in program-level quality improvement efforts.

## Getting Started

These instructions will give you a copy of the project up and running on
your local machine for development and testing purposes. See deployment
for notes on deploying the project on a live system.

### Prerequisites

Requirements for the software and other tools to build, test and push

- [Node.js](https://nodejs.org/)
- [npm](https://www.npmjs.com/)

### Installing

A step by step series of examples that tell you how to get a development
environment running

Clone the repository

    git clone https://github.com/cfu288/RECOCA.git

Navigate to the project directory

    cd recoca

Install dependencies

    npm install

Start the application in development mode

    npm start

## Running the tests

Run tests:

    npm test

### Style test

Check code formatting and linting:

    npm run lint

## Deployment

Build the application for distribution:

    npm run make

The packaged application will be available in the `out` directory.

## Built With

- [Electron](https://www.electronjs.org/) - Desktop application framework
- [React](https://reactjs.org/) - UI library
- [TypeScript](https://www.typescriptlang.org/) - Programming language
- [Polars](https://pola.rs/) - Data processing library

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code
of conduct, and the process for submitting pull requests to us.

## Versioning

We use [Semantic Versioning](http://semver.org/) for versioning. For the versions
available, see the [tags on this
repository](https://github.com/cfu288/RECOCA/tags).

## Authors

- **Christopher Fu** - _Initial work_ - [cfu288](https://github.com/cfu288)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for
details
