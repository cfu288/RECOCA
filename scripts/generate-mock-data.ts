import * as fs from 'fs';
import * as path from 'path';

type AppointmentDistribution = 'uniform' | 'normal' | 'exponential' | 'power-law';

interface MockDataConfig {
  // Basic parameters
  numPatients: number;
  numDoctors: number;
  
  // Date range
  startDate: Date;
  endDate: Date;
  
  // Behavior parameters
  sameDoctorProbability: number; // 0-1, probability of seeing same doctor
  
  // Appointment distribution parameters
  appointmentDistribution: AppointmentDistribution;
  appointmentsPerPatientMin: number;
  appointmentsPerPatientMax: number;
  appointmentsMean?: number; // For normal distribution
  appointmentsStdDev?: number; // For normal distribution
  
  // Output
  outputPath: string;
  outputFilename?: string;
  
  // Reproducibility
  seed?: number; // Optional seed for reproducible random generation
}

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  lastDoctor?: string;
}

interface Appointment {
  patient_id: string;
  patient_first_name: string;
  patient_last_name: string;
  doctor_id: string;
  appointment_date: string;
}

// Common first names
const firstNames = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
  'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa',
  'Matthew', 'Betty', 'Anthony', 'Helen', 'Mark', 'Sandra', 'Donald', 'Donna',
  'Steven', 'Carol', 'Kenneth', 'Ruth', 'Andrew', 'Sharon', 'Joshua', 'Michelle',
  'Kevin', 'Laura', 'Brian', 'Sarah', 'George', 'Kimberly', 'Edward', 'Deborah',
  'Ronald', 'Dorothy', 'Timothy', 'Lisa', 'Jason', 'Nancy', 'Jeffrey', 'Karen',
  'Ryan', 'Betty', 'Jacob', 'Helen', 'Gary', 'Sandra', 'Nicholas', 'Donna',
  'Eric', 'Carol', 'Jonathan', 'Ruth', 'Stephen', 'Sharon', 'Larry', 'Michelle',
  'Justin', 'Laura', 'Scott', 'Sarah', 'Brandon', 'Kimberly', 'Benjamin', 'Deborah',
  'Samuel', 'Jessica', 'Frank', 'Shirley', 'Gregory', 'Cynthia', 'Raymond', 'Angela',
  'Alexander', 'Melissa', 'Patrick', 'Brenda', 'Jack', 'Emma', 'Dennis', 'Amy',
  'Jerry', 'Anna', 'Tyler', 'Rebecca', 'Aaron', 'Virginia', 'Jose', 'Kathleen'
];

// Common last names
const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
  'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White',
  'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young',
  'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell',
  'Carter', 'Roberts', 'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker',
  'Cruz', 'Edwards', 'Collins', 'Reyes', 'Stewart', 'Morris', 'Morales', 'Murphy',
  'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper', 'Peterson', 'Bailey',
  'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson',
  'Watson', 'Brooks', 'Chavez', 'Wood', 'James', 'Bennett', 'Gray', 'Mendoza',
  'Ruiz', 'Hughes', 'Price', 'Alvarez', 'Castillo', 'Sanders', 'Patel', 'Myers'
];

class MockDataGenerator {
  private config: MockDataConfig;
  private patients: Map<string, Patient> = new Map();
  private doctors: string[] = [];
  private appointments: Appointment[] = [];
  private seed: number;

  constructor(config: MockDataConfig) {
    this.config = config;
    this.seed = config.seed || Date.now(); // Use provided seed or timestamp as default
    this.initializeDoctors();
    this.initializePatients();
  }

  // Simple seeded random number generator (Linear Congruential Generator)
  private random(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 2147483647;
    return this.seed / 2147483647;
  }

  private initializeDoctors(): void {
    for (let i = 1; i <= this.config.numDoctors; i++) {
      this.doctors.push(`Doctor ${i}`);
    }
  }

  private generateAppointmentCount(): number {
    const { appointmentDistribution, appointmentsPerPatientMin, appointmentsPerPatientMax, appointmentsMean, appointmentsStdDev } = this.config;
    
    switch (appointmentDistribution) {
      case 'uniform': {
        // Original uniform distribution
        return Math.floor(
          this.random() * (appointmentsPerPatientMax - appointmentsPerPatientMin + 1) + appointmentsPerPatientMin
        );
      }
      
      case 'normal': {
        // Normal distribution with mean and std dev
        const mean = appointmentsMean || (appointmentsPerPatientMin + appointmentsPerPatientMax) / 2;
        const stdDev = appointmentsStdDev || (appointmentsPerPatientMax - appointmentsPerPatientMin) / 4;
        const count = this.normalRandom(mean, stdDev);
        // Clamp to min/max
        return Math.max(appointmentsPerPatientMin, Math.min(appointmentsPerPatientMax, Math.round(count)));
      }
      
      case 'exponential': {
        // Most patients have few appointments, decreases exponentially
        const lambda = 1 / ((appointmentsPerPatientMax - appointmentsPerPatientMin) / 3);
        const count = Math.floor(-Math.log(1 - this.random()) / lambda) + appointmentsPerPatientMin;
        return Math.min(count, appointmentsPerPatientMax);
      }
      
      case 'power-law': {
        // Power law distribution (80/20 rule - most have very few, some have many)
        const alpha = 2; // Shape parameter
        const xMin = appointmentsPerPatientMin;
        const xMax = appointmentsPerPatientMax;
        const u = this.random();
        const count = Math.floor(xMin * Math.pow((1 - u) * (1 - Math.pow(xMax/xMin, 1-alpha)), 1/(1-alpha)));
        return Math.min(count, appointmentsPerPatientMax);
      }
      
      default:
        return appointmentsPerPatientMin;
    }
  }
  
  private normalRandom(mean: number, stdDev: number): number {
    // Box-Muller transform for normal distribution
    let u = 0, v = 0;
    while (u === 0) u = this.random(); // Converting [0,1) to (0,1)
    while (v === 0) v = this.random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z * stdDev + mean;
  }

  private initializePatients(): void {
    const usedNames = new Set<string>();
    
    for (let i = 1; i <= this.config.numPatients; i++) {
      let firstName: string;
      let lastName: string;
      let fullName: string;
      
      // Ensure unique combinations
      do {
        firstName = this.getRandomElement(firstNames);
        lastName = this.getRandomElement(lastNames);
        fullName = `${firstName} ${lastName}`;
      } while (usedNames.has(fullName) && usedNames.size < firstNames.length * lastNames.length);
      
      usedNames.add(fullName);
      
      const patient: Patient = {
        id: `P${i.toString().padStart(4, '0')}`,
        firstName,
        lastName
      };
      
      this.patients.set(patient.id, patient);
    }
  }

  private getRandomElement<T>(array: T[]): T {
    return array[Math.floor(this.random() * array.length)];
  }

  private getRandomDate(start: Date, end: Date): Date {
    const startTime = start.getTime();
    const endTime = end.getTime();
    const randomTime = startTime + this.random() * (endTime - startTime);
    return new Date(randomTime);
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private selectDoctor(patient: Patient): string {
    // First visit for patient - random doctor
    if (!patient.lastDoctor) {
      return this.getRandomElement(this.doctors);
    }
    
    // For 0% same-provider, actively avoid the previous doctor if possible
    if (this.config.sameDoctorProbability === 0 && this.doctors.length > 1) {
      const availableDoctors = this.doctors.filter(d => d !== patient.lastDoctor);
      return this.getRandomElement(availableDoctors);
    }
    
    // Use probability to determine if they see the same doctor
    if (this.random() < this.config.sameDoctorProbability) {
      return patient.lastDoctor;
    }
    
    // Random doctor
    return this.getRandomElement(this.doctors);
  }

  public generateAppointments(): void {
    // Generate appointments patient by patient
    this.patients.forEach((patient) => {
      // Determine number of appointments for this patient
      const numAppointments = this.generateAppointmentCount();
      
      // Generate appointment dates for this patient
      const appointmentDates: Date[] = [];
      for (let i = 0; i < numAppointments; i++) {
        appointmentDates.push(this.getRandomDate(this.config.startDate, this.config.endDate));
      }
      
      // Sort dates chronologically for this patient
      appointmentDates.sort((a, b) => a.getTime() - b.getTime());
      
      // Create appointments in chronological order for this patient
      appointmentDates.forEach((date) => {
        const doctor = this.selectDoctor(patient);
        patient.lastDoctor = doctor;
        
        const appointment: Appointment = {
          patient_id: patient.id,
          patient_first_name: patient.firstName,
          patient_last_name: patient.lastName,
          doctor_id: doctor,
          appointment_date: this.formatDate(date)
        };
        
        this.appointments.push(appointment);
      });
    });
    
    
    // Sort all appointments by date
    this.appointments.sort((a, b) => 
      a.appointment_date.localeCompare(b.appointment_date)
    );
  }

  public saveToCSV(): void {
    // Create CSV content
    const headers = ['patient_id', 'patient_first_name', 'patient_last_name', 'doctor_id', 'appointment_date'];
    const rows = [headers.join(',')];
    
    this.appointments.forEach(apt => {
      rows.push([
        apt.patient_id,
        apt.patient_first_name,
        apt.patient_last_name,
        apt.doctor_id,
        apt.appointment_date
      ].join(','));
    });
    
    const csv = rows.join('\n');
    
    const filename = this.config.outputFilename || 
      `mock_appointments_${this.config.numPatients}p_${this.config.numDoctors}d_${
        Math.round(this.config.sameDoctorProbability * 100)
      }sp.csv`;
    
    const filepath = path.join(this.config.outputPath, filename);
    fs.writeFileSync(filepath, csv);
    
    console.log(`Generated ${this.appointments.length} appointments`);
    console.log(`Saved to: ${filepath}`);
    
    // Print summary statistics
    this.printStatistics();
  }

  private printStatistics(): void {
    console.log('\n--- Summary Statistics ---');
    console.log(`Total Patients: ${this.config.numPatients}`);
    console.log(`Total Doctors: ${this.config.numDoctors}`);
    console.log(`Total Appointments: ${this.appointments.length}`);
    console.log(`Random Seed: ${this.config.seed || 'timestamp'}`);
    
    // Calculate actual continuity
    const patientDoctorHistory = new Map<string, string[]>();
    this.appointments.forEach(apt => {
      if (!patientDoctorHistory.has(apt.patient_id)) {
        patientDoctorHistory.set(apt.patient_id, []);
      }
      patientDoctorHistory.get(apt.patient_id)!.push(apt.doctor_id);
    });
    
    let continuityCount = 0;
    let totalTransitions = 0;
    
    patientDoctorHistory.forEach(doctors => {
      for (let i = 1; i < doctors.length; i++) {
        if (doctors[i] === doctors[i-1]) {
          continuityCount++;
        }
        totalTransitions++;
      }
    });
    
    const actualContinuity = totalTransitions > 0 ? continuityCount / totalTransitions : 0;
    console.log(`Actual Same-Provider Rate: ${(actualContinuity * 100).toFixed(1)}%`);
    console.log(`(Target was: ${(this.config.sameDoctorProbability * 100).toFixed(1)}%)`);
    
    // Show the accuracy for non-trivial cases
    if (this.config.numDoctors > 1 && totalTransitions > 0) {
      const targetRate = this.config.sameDoctorProbability * 100;
      const actualRate = actualContinuity * 100;
      const accuracy = 100 - Math.abs(actualRate - targetRate);
      console.log(`Accuracy: ${accuracy.toFixed(1)}%`);
    }
    
    // Show distribution of appointments per patient
    const appointmentsPerPatient = new Map<string, number>();
    this.appointments.forEach(apt => {
      appointmentsPerPatient.set(apt.patient_id, (appointmentsPerPatient.get(apt.patient_id) || 0) + 1);
    });
    
    const distribution: Record<number, number> = {};
    appointmentsPerPatient.forEach(count => {
      distribution[count] = (distribution[count] || 0) + 1;
    });
    
    console.log('\nAppointments per patient distribution:');
    Object.keys(distribution).sort((a, b) => Number(a) - Number(b)).forEach(count => {
      console.log(`  ${count} appointments: ${distribution[Number(count)]} patients`);
    });
  }
}

// Main execution
if (require.main === module) {
  // Default configuration
  const config: MockDataConfig = {
    numPatients: 100,
    numDoctors: 5,
    startDate: new Date('2023-01-01'),
    endDate: new Date('2023-12-31'),
    sameDoctorProbability: 0.7, // 70% chance of seeing same provider
    appointmentDistribution: 'uniform',
    appointmentsPerPatientMin: 2,
    appointmentsPerPatientMax: 10,
    appointmentsMean: undefined,
    appointmentsStdDev: undefined,
    outputPath: './generated-data',
    outputFilename: undefined // Will use default naming
  };

  // Parse command line arguments if provided
  const args = process.argv.slice(2);
  
  // Show help if requested
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Mock Medical Appointment Data Generator

Usage: npx tsx scripts/generate-mock-data.ts [options]

Options:
  --patients=N              Number of patients (default: 100)
  --doctors=N               Number of doctors (default: 5)
  --same-provider=0.X       Probability of seeing same provider (0-1, default: 0.7)
  --start=YYYY-MM-DD        Start date for appointments (default: 2023-01-01)
  --end=YYYY-MM-DD          End date for appointments (default: 2023-12-31)
  --min-appts=N             Minimum appointments per patient (default: 2)
  --max-appts=N             Maximum appointments per patient (default: 10)
  --distribution=TYPE       Appointment count distribution: uniform, normal, exponential, power-law (default: uniform)
  --mean=N                  Mean for normal distribution (default: midpoint of min/max)
  --stddev=N                Standard deviation for normal distribution (default: range/4)
  --output=filename         Output filename (default: auto-generated)
  --seed=N                  Random seed for reproducible results (default: current timestamp)
  --help, -h                Show this help message

Examples:
  # Generate high same-provider probability data
  npx ts-node scripts/generate-mock-data.ts --patients=200 --doctors=10 --same-provider=0.9

  # Generate with normal distribution (most patients have ~5 appointments)
  npx ts-node scripts/generate-mock-data.ts --distribution=normal --mean=5 --stddev=2

  # Generate with exponential decay (most have 1-2 visits, few have many)
  npx ts-node scripts/generate-mock-data.ts --distribution=exponential --min-appts=1 --max-appts=20

  # Generate with power-law distribution (80/20 rule)
  npx ts-node scripts/generate-mock-data.ts --distribution=power-law --min-appts=1 --max-appts=30
    `);
    process.exit(0);
  }
  
  args.forEach((arg) => {
    const [key, value] = arg.split('=');
    switch (key) {
      case '--patients':
        config.numPatients = parseInt(value);
        break;
      case '--doctors':
        config.numDoctors = parseInt(value);
        break;
      case '--continuity':
      case '--same-provider':
      case '--same-provider-probability':
        config.sameDoctorProbability = parseFloat(value);
        break;
      case '--output':
        config.outputFilename = value;
        break;
      case '--seed':
        config.seed = parseInt(value);
        break;
      case '--start':
        config.startDate = new Date(value);
        break;
      case '--end':
        config.endDate = new Date(value);
        break;
      case '--min-appts':
        config.appointmentsPerPatientMin = parseInt(value);
        break;
      case '--max-appts':
        config.appointmentsPerPatientMax = parseInt(value);
        break;
      case '--distribution':
        config.appointmentDistribution = value as AppointmentDistribution;
        break;
      case '--mean':
        config.appointmentsMean = parseFloat(value);
        break;
      case '--stddev':
        config.appointmentsStdDev = parseFloat(value);
        break;
    }
  });

  // Create output directory if it doesn't exist
  if (!fs.existsSync(config.outputPath)) {
    fs.mkdirSync(config.outputPath, { recursive: true });
  }

  // Generate data
  const generator = new MockDataGenerator(config);
  generator.generateAppointments();
  generator.saveToCSV();
}

export { MockDataGenerator, MockDataConfig };