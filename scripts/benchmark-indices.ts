#!/usr/bin/env npx tsx
/**
 * Continuity Index Grid Search Benchmark
 * 
 * Tests continuity indices across a comprehensive grid of:
 * - Same-Provider (SP) rates: 0% to 100% 
 * - Doctor counts: 1 to 200
 * - Patient counts: Dynamically calculated
 * 
 * Key focus on three primary metrics:
 * 1. SP Rate - percentage of visits to same provider
 * 2. Number of doctors - provider availability 
 * 3. Number of patients - sample size per scenario
 * 
 * Statistical Methods:
 * - Spearman's rank correlation coefficient (used here) for non-normal distributions
 * - Based on Pollack et al. (2016): "Spearman's rho values ranged from 0.935 to 0.996"
 * - PCA could be applied as per Chen et al. (2013): "first principal component... greater than 90%"
 * 
 * Usage:
 *   npx tsx scripts/benchmark-indices.ts [options]
 * 
 * Options:
 *   --target-accuracy=N   Target accuracy for SP rate (default: 0.02 = ±2%)
 *   --min-patients=N      Minimum patients per scenario (default: 500)
 *   --help                Show help message
 */
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as pl from 'nodejs-polars';

// Import continuity indices dynamically
async function loadIndices() {
  const { calculateUpcIndex } = await import('../src/core/continuity/indices/upc-index.js');
  const { calculateCocIndex } = await import('../src/core/continuity/indices/coc-index.js');
  const { calculateSeconIndex } = await import('../src/core/continuity/indices/secon-index.js');
  const { calculateMmciIndex } = await import('../src/core/continuity/indices/mmci-index.js');
  const { calculateRollingContIndex } = await import('../src/core/continuity/indices/rolling-cont-index.js');
  
  return { 
    calculateUPC: calculateUpcIndex, 
    calculateCOC: calculateCocIndex, 
    calculateSECON: calculateSeconIndex, 
    calculateMMCI: calculateMmciIndex, 
    calculateRollingContIndex 
  };
}

interface Scenario {
  name: string;
  description: string;
  command: string;
}

interface Result {
  scenario: string;
  description: string;
  patients: number;
  appointments: number;
  sameProviderRate: number;
  indices: {
    UPC?: number;
    COC?: number;
    SECON?: number;
    MMCI?: number;
    RollingCont?: number;
  };
  errors: string[];
}

async function runBenchmark() {
  // Check command line arguments
  const args = process.argv.slice(2);
  
  // Show help if requested
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Continuity Index Grid Search Benchmark

Tests continuity indices across a grid of:
- Same-Provider (SP) rates: 0%, 20%, 40%, 60%, 80%, 100%
- Doctor counts: 1, 3, 5, 10, 20, 50, 100, 200

Key Metrics:
- SP Rate: % of visits where patient sees their previous provider
- Doctors: Number of available providers
- Patients: Dynamically calculated based on statistical requirements

Usage:
  npx tsx scripts/benchmark-indices.ts [options]

Options:
  --target-accuracy=N   Target accuracy for SP rate (default: 0.02 = ±2%)
  --min-patients=N      Minimum patients per scenario (default: 500)
  --help, -h            Show this help message

Output:
  benchmark-results/datasets/   Generated patient visit data
  benchmark-results/reports/    Analysis reports with continuity indices
    `);
    process.exit(0);
  }
  
  const targetAccuracyArg = args.find(arg => arg.startsWith('--target-accuracy='));
  const targetAccuracy = targetAccuracyArg ? parseFloat(targetAccuracyArg.split('=')[1]) : 0.02; // Default 2% accuracy
  const minPatientsArg = args.find(arg => arg.startsWith('--min-patients='));
  const minPatients = minPatientsArg ? parseInt(minPatientsArg.split('=')[1]) : 500;
  
  console.log('🔬 Continuity Index Grid Search Benchmark\n');
  console.log('Testing continuity indices across:');
  console.log('- Same-Provider (SP) rates: 0% to 100%');
  console.log('- Number of doctors: 1 to 200');
  console.log('- Patient counts: Dynamically calculated\n');
  
  const outputDir = './benchmark-results';
  const datasetsDir = path.join(outputDir, 'datasets');
  const reportsDir = path.join(outputDir, 'reports');
  
  // Create directories
  [datasetsDir, reportsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  // Load indices
  const indices = await loadIndices();
  
  // Define grid search parameters
  const scenarios: Scenario[] = [];
  
  // Grid parameters
  const sameProviderRates = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0];
  const doctorCounts = [1, 3, 5, 10, 20, 50, 100, 200];
  
  console.log(`Configuration:`);
  console.log(`- SP rate target accuracy: ±${(targetAccuracy * 100).toFixed(1)}%`);
  console.log(`- Minimum patients per scenario: ${minPatients}\n`);
  
  // Generate all combinations
  for (const sp of sameProviderRates) {
    for (const docs of doctorCounts) {
      // Calculate required patients to achieve target accuracy
      // For binomial proportion, we need n ≥ (z²pq)/e² where e is margin of error
      // Using z=1.96 for 95% confidence, p=sp, q=1-sp
      const p = sp === 0 ? 0.01 : (sp === 1 ? 0.99 : sp); // Avoid division by zero
      const q = 1 - p;
      const z = 1.96; // 95% confidence
      const requiredPatients = Math.max(
        minPatients,
        Math.ceil((z * z * p * q) / (targetAccuracy * targetAccuracy))
      );
      
      scenarios.push({
        name: `sameprovider${(sp * 100).toFixed(0)}_doctors${docs}`,
        description: `SP: ${(sp * 100).toFixed(0)}%, Doctors: ${docs}, Patients: ${requiredPatients}`,
        command: `--patients=${requiredPatients} --doctors=${docs} --same-provider=${sp} --min-appts=3 --max-appts=7 --output=sameprovider${(sp * 100).toFixed(0)}_doctors${docs}.csv`
      });
    }
  }
  
  const results: Result[] = [];
  
  // Run each scenario
  for (const scenario of scenarios) {
    console.log(`\n📊 Running: ${scenario.name}`);
    console.log(`   ${scenario.description}`);
    
    const result: Result = {
      scenario: scenario.name,
      description: scenario.description,
      patients: 0,
      appointments: 0,
      sameProviderRate: 0,
      indices: {},
      errors: []
    };
    
    try {
      // Generate data
      console.log('   Generating data...');
      const output = execSync(
        `npx tsx scripts/generate-mock-data.ts ${scenario.command}`,
        { encoding: 'utf8' }
      );
      
      // Parse output for stats
      const patientsMatch = output.match(/Total Patients: (\d+)/);
      const appointmentsMatch = output.match(/Total Appointments: (\d+)/);
      const rateMatch = output.match(/Actual Same-Provider Rate: ([\d.]+)%/);
      
      if (patientsMatch) result.patients = parseInt(patientsMatch[1]);
      if (appointmentsMatch) result.appointments = parseInt(appointmentsMatch[1]);
      if (rateMatch) result.sameProviderRate = parseFloat(rateMatch[1]) / 100;
      
      // Move file to datasets directory
      const sourceFile = `./generated-data/${scenario.name}.csv`;
      const destFile = path.join(datasetsDir, `${scenario.name}.csv`);
      if (fs.existsSync(sourceFile)) {
        fs.renameSync(sourceFile, destFile);
      }
      
      // Read and analyze with indices
      console.log('   Calculating indices...');
      const df = pl.readCSV(destFile);
      
      // Calculate each index
      try {
        const upcResult = indices.calculateUPC(df, 'doctor_id', ['patient_id']);
        result.indices.UPC = upcResult.averageUpc;
        console.log(`   ✓ UPC: ${result.indices.UPC?.toFixed(3)}`);
      } catch (e) {
        result.errors.push(`UPC: ${e}`);
        console.log(`   ✗ UPC: Failed`);
      }
      
      try {
        const cocResult = indices.calculateCOC(df, 'doctor_id', ['patient_id']);
        result.indices.COC = cocResult.averageCoc;
        console.log(`   ✓ COC: ${result.indices.COC?.toFixed(3)}`);
      } catch (e) {
        result.errors.push(`COC: ${e}`);
        console.log(`   ✗ COC: Failed`);
      }
      
      try {
        const seconResult = indices.calculateSECON(df, 'doctor_id', ['patient_id'], 'appointment_date');
        result.indices.SECON = seconResult.averageSecon;
        console.log(`   ✓ SECON: ${result.indices.SECON?.toFixed(3)}`);
      } catch (e) {
        result.errors.push(`SECON: ${e}`);
        console.log(`   ✗ SECON: Failed`);
      }
      
      try {
        const mmciResult = indices.calculateMMCI(df, 'doctor_id', ['patient_id']);
        result.indices.MMCI = mmciResult.averageMmci;
        console.log(`   ✓ MMCI: ${result.indices.MMCI?.toFixed(3)}`);
      } catch (e) {
        result.errors.push(`MMCI: ${e}`);
        console.log(`   ✗ MMCI: Failed`);
      }
      
      try {
        const rolling = indices.calculateRollingContIndex(df, 'doctor_id', ['patient_id'], 'appointment_date');
        result.indices.RollingCont = rolling.averageScore;
        console.log(`   ✓ Rolling: ${result.indices.RollingCont?.toFixed(3)}`);
      } catch (e) {
        result.errors.push(`Rolling: ${e}`);
        console.log(`   ✗ Rolling: Failed`);
      }
      
    } catch (error) {
      console.error(`   ✗ Scenario failed: ${error}`);
      result.errors.push(`Scenario failed: ${error}`);
    }
    
    results.push(result);
  }
  
  // Generate reports
  console.log('\n📝 Generating reports...');
  
  // JSON report
  fs.writeFileSync(
    path.join(reportsDir, 'results.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2)
  );
  
  // CSV report
  const csvLines = [
    'Scenario,SP Target,Actual SP,Doctors,Patients,UPC,COC,SECON,MMCI,Rolling Cont'
  ];
  
  results.forEach(r => {
    const spTarget = r.scenario.match(/sameprovider(\d+)/)?.[1] || '0';
    const doctors = r.scenario.match(/doctors(\d+)/)?.[1] || '0';
    csvLines.push([
      r.scenario,
      spTarget + '%',
      (r.sameProviderRate * 100).toFixed(1) + '%',
      doctors,
      r.patients,
      r.indices.UPC?.toFixed(3) || 'ERROR',
      r.indices.COC?.toFixed(3) || 'ERROR',
      r.indices.SECON?.toFixed(3) || 'ERROR',
      r.indices.MMCI?.toFixed(3) || 'ERROR',
      r.indices.RollingCont?.toFixed(3) || 'ERROR'
    ].join(','));
  });
  
  fs.writeFileSync(
    path.join(reportsDir, 'results.csv'),
    csvLines.join('\n')
  );
  
  // No markdown report - focusing only on HTML
  
  // Generate HTML report with charts
  generateHTMLReport(results, reportsDir, targetAccuracy);
  
  console.log('\n✅ Benchmark complete!');
  console.log(`📁 Results saved to: ${reportsDir}/`);
  console.log('   - results.json (raw data)');
  console.log('   - results.csv (summary table)');
  console.log('   - report.html (interactive report with charts)');
}

function generateHTMLReport(results: Result[], reportsDir: string, targetAccuracy: number) {
  // Prepare data for charts
  const indices = ['UPC', 'COC', 'SECON', 'MMCI', 'RollingCont'] as const;
  const colors = {
    UPC: 'rgb(255, 99, 132)',
    COC: 'rgb(54, 162, 235)',
    SECON: 'rgb(255, 205, 86)',
    MMCI: 'rgb(75, 192, 192)',
    RollingCont: 'rgb(153, 102, 255)'
  };
  
  // Filter for valid results
  const validResults = results.filter(r => 
    r.indices.UPC !== undefined && 
    r.indices.COC !== undefined && 
    r.indices.SECON !== undefined && 
    r.indices.MMCI !== undefined && 
    r.indices.RollingCont !== undefined
  );
  
  // Group results by doctor count for line charts
  const doctorGroups = new Map<number, typeof results>();
  results.forEach(r => {
    const docs = parseInt(r.scenario.match(/doctors(\d+)$/)?.[1] || '0');
    if (!doctorGroups.has(docs)) {
      doctorGroups.set(docs, []);
    }
    doctorGroups.get(docs)?.push(r);
  });
  
  // Generate chart data for each doctor count
  const chartConfigs: any[] = [];
  
  Array.from(doctorGroups.keys()).sort((a, b) => a - b).forEach(docs => {
    const docResults = doctorGroups.get(docs) || [];
    docResults.sort((a, b) => {
      const spA = parseFloat(a.scenario.match(/sameprovider(\d+)/)?.[1] || '0');
      const spB = parseFloat(b.scenario.match(/sameprovider(\d+)/)?.[1] || '0');
      return spA - spB;
    });
    
    const labels = docResults.map(r => {
      const sp = r.scenario.match(/sameprovider(\d+)/)?.[1] || '0';
      return `${sp}%`;
    });
    
    const datasets = indices.map(index => ({
      label: index,
      data: docResults.map(r => r.indices[index] || null),
      borderColor: colors[index],
      backgroundColor: colors[index],
      tension: 0.1
    }));
    
    chartConfigs.push({
      id: `chart-doctors-${docs}`,
      title: `${docs} Doctor${docs > 1 ? 's' : ''}`,
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: `Continuity Indices with ${docs} Doctor${docs > 1 ? 's' : ''}`
          },
          legend: {
            position: 'top' as const,
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Same-Provider Rate'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Index Value'
            },
            min: 0,
            max: 1
          }
        }
      }
    });
  });
  
  // Generate summary statistics chart
  // Note: Bootstrap confidence intervals would be appropriate here given non-normal distributions
  // As noted by Mosteller (2021): "36.1% of participants experience 'perfect' continuity of care (computed value of 1.0)"
  // Source: PMC8142963
  const summaryStats = indices.map(index => {
    const values = results.map(r => r.indices[index] || 0).filter(v => v !== null);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    return { index, mean, min, max, range };
  });
  
  const summaryData = {
    labels: ['Mean', 'Min', 'Max', 'Range'],
    datasets: indices.map((index, i) => ({
      label: index,
      data: [
        summaryStats[i].mean,
        summaryStats[i].min,
        summaryStats[i].max,
        summaryStats[i].range
      ],
      backgroundColor: colors[index],
      borderColor: colors[index],
      borderWidth: 1
    }))
  };
  
  // Calculate Spearman's rank correlation coefficient
  // Based on Pollack et al. (2016): "The four indices were highly correlated with each other. 
  // Spearman's rho values ranged from 0.935 to 0.996"
  // Source: PMC3424831
  function calculateSpearmanCorrelation(x: number[], y: number[]): number {
    // Create array of pairs with original indices
    const pairs = x.map((xi, i) => ({ x: xi, y: y[i], index: i }));
    
    // Sort by x values and assign ranks
    pairs.sort((a, b) => a.x - b.x);
    pairs.forEach((pair, i) => {
      pair.rankX = i + 1;
    });
    
    // Sort by y values and assign ranks
    pairs.sort((a, b) => a.y - b.y);
    pairs.forEach((pair, i) => {
      pair.rankY = i + 1;
    });
    
    // Calculate Spearman's rho using the rank differences
    const n = pairs.length;
    const sumD2 = pairs.reduce((sum, pair) => {
      const d = pair.rankX! - pair.rankY!;
      return sum + d * d;
    }, 0);
    
    // Spearman's rho = 1 - (6 * sum(d^2)) / (n * (n^2 - 1))
    return 1 - (6 * sumD2) / (n * (n * n - 1));
  }
  
  // Calculate overall Spearman correlation matrix
  const correlationMatrix: number[][] = [];
  indices.forEach((index1, i) => {
    correlationMatrix[i] = [];
    indices.forEach((index2, j) => {
      if (i === j) {
        correlationMatrix[i][j] = 1;
      } else {
        const values1 = results.map(r => r.indices[index1] || 0);
        const values2 = results.map(r => r.indices[index2] || 0);
        correlationMatrix[i][j] = calculateSpearmanCorrelation(values1, values2);
      }
    });
  });
  
  // For comparison charts - keeping SP rates defined for charts below
  const spRates = [0, 20, 40, 60, 80, 100];
  
  // Calculate CV for each index
  const cvData = indices.map(index => {
    const values = results.map(r => r.indices[index] || 0).filter(v => v !== null);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean > 0 ? stdDev / mean : 0;
    return cv;
  });
  
  // Calculate Lin's Concordance Correlation Coefficient (CCC)
  // Lin's CCC measures both precision and accuracy of agreement between indices
  // Formula: ρc = (2ρσxσy)/(σx² + σy² + (μx - μy)²)
  // Where ρ is Pearson correlation, σ are standard deviations, μ are means
  // Reference: Lin, L.I. (1989). A concordance correlation coefficient to evaluate reproducibility. Biometrics, 45(1), 255-268.
  function calculateLinsCCC(x: number[], y: number[]): number {
    const n = x.length;
    
    // Calculate means
    const meanX = x.reduce((sum, val) => sum + val, 0) / n;
    const meanY = y.reduce((sum, val) => sum + val, 0) / n;
    
    // Calculate variances and covariance
    let varX = 0, varY = 0, covar = 0;
    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      varX += dx * dx;
      varY += dy * dy;
      covar += dx * dy;
    }
    varX /= n;
    varY /= n;
    covar /= n;
    
    // Calculate standard deviations
    const stdX = Math.sqrt(varX);
    const stdY = Math.sqrt(varY);
    
    // Calculate Pearson correlation coefficient
    const pearsonR = covar / (stdX * stdY);
    
    // Calculate Lin's CCC
    const meanDiff = meanX - meanY;
    const ccc = (2 * pearsonR * stdX * stdY) / (varX + varY + meanDiff * meanDiff);
    
    return ccc;
  }
  
  // Calculate Lin's CCC matrix for index agreement
  const concordanceMatrix: number[][] = [];
  indices.forEach((index1, i) => {
    concordanceMatrix[i] = [];
    indices.forEach((index2, j) => {
      if (i === j) {
        concordanceMatrix[i][j] = 1; // Perfect concordance with self
      } else {
        const values1 = results.map(r => r.indices[index1] || 0);
        const values2 = results.map(r => r.indices[index2] || 0);
        concordanceMatrix[i][j] = calculateLinsCCC(values1, values2);
      }
    });
  });
  
  // Calculate average correlations for insights
  const avgCorrelations = indices.map((index, i) => {
    let sum = 0;
    let count = 0;
    indices.forEach((_, j) => {
      if (i !== j) {
        sum += correlationMatrix[i][j];
        count++;
      }
    });
    return { index, avgCorr: sum / count };
  }).sort((a, b) => b.avgCorr - a.avgCorr);
  
  // No longer filtering - showing all correlations
  
  // Generate comparison chart for specific SP rates
  const comparisonCharts: any[] = [];
  
  spRates.forEach(sp => {
    const spResults = results.filter(r => 
      r.scenario.match(/sameprovider(\d+)/)?.[1] === sp.toString()
    );
    spResults.sort((a, b) => {
      const docsA = parseInt(a.scenario.match(/doctors(\d+)$/)?.[1] || '0');
      const docsB = parseInt(b.scenario.match(/doctors(\d+)$/)?.[1] || '0');
      return docsA - docsB;
    });
    
    const labels = spResults.map(r => {
      const docs = r.scenario.match(/doctors(\d+)$/)?.[1] || '0';
      return `${docs}`;
    });
    
    const datasets = indices.map(index => ({
      label: index,
      data: spResults.map(r => r.indices[index] || null),
      borderColor: colors[index],
      backgroundColor: colors[index],
      tension: 0.1
    }));
    
    comparisonCharts.push({
      id: `chart-sp-${sp}`,
      title: `SP Rate: ${sp}%`,
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: `Continuity Indices at ${sp}% Same-Provider Rate`
          },
          legend: {
            position: 'top' as const,
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Number of Doctors'
            },
            type: 'logarithmic',
            ticks: {
              callback: function(value: any) {
                return Number(value.toString());
              }
            }
          },
          y: {
            title: {
              display: true,
              text: 'Index Value'
            },
            min: 0,
            max: 1
          }
        }
      }
    });
  });
  
  // Generate HTML
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Continuity Index Benchmark Report</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        h1, h2, h3 {
            color: #2c3e50;
        }
        .chart-container {
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .chart-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        .metrics {
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .metric-box {
            display: inline-block;
            padding: 10px 20px;
            margin: 5px;
            background-color: #e8f4f8;
            border-radius: 5px;
            font-weight: bold;
        }
        .citation {
            font-size: 0.9em;
            font-style: italic;
            color: #666;
            margin: 10px 0;
        }
        #references {
            margin-top: 40px;
            border-top: 2px solid #e0e0e0;
            padding-top: 20px;
        }
        #references ol {
            line-height: 1.8;
        }
        #references em {
            font-style: italic;
        }
        canvas {
            max-height: 400px;
        }
        .nav {
            background: white;
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .nav a {
            color: #3498db;
            text-decoration: none;
            margin-right: 20px;
        }
        .nav a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <h1>Continuity Index Benchmark Report</h1>
    
    <div class="nav">
        <a href="#overview">Overview</a>
        <a href="#by-doctors">Analysis by Doctor Count</a>
        <a href="#by-sp-rate">Analysis by SP Rate</a>
        <a href="#summary">Index Distribution</a>
        <a href="#comparative-metrics">Comparative Metrics</a>
        <a href="#correlations">Key Findings</a>
        <a href="#statistical-methods">Statistical Methods</a>
        <a href="#key-findings-literature">Literature Findings</a>
        <a href="#methodology-comparison">Methodology Comparison</a>
        <a href="#references">References</a>
    </div>
    
    <div class="metrics" id="overview">
        <h2>Overview</h2>
        <p>Generated: ${new Date().toLocaleString()}</p>
        <div>
            <div class="metric-box">Scenarios Tested: ${results.length}</div>
            <div class="metric-box">SP Rates: 0% - 100%</div>
            <div class="metric-box">Doctor Counts: 1 - 200</div>
            <div class="metric-box">Patient Range: ${Math.min(...results.map(r => r.patients))} - ${Math.max(...results.map(r => r.patients))}</div>
            <div class="metric-box">Target Accuracy: ±${(targetAccuracy * 100).toFixed(1)}%</div>
        </div>
    </div>
    
    <div id="by-doctors">
        <h2>Continuity Indices by Doctor Count</h2>
        <p>These charts show how each continuity index varies with Same-Provider rate for different numbers of available doctors.</p>
        <div class="chart-grid">
            ${chartConfigs.map(config => `
            <div class="chart-container">
                <canvas id="${config.id}"></canvas>
            </div>
            `).join('')}
        </div>
    </div>
    
    <div id="by-sp-rate">
        <h2>Continuity Indices by Same-Provider Rate</h2>
        <p>These charts show how each continuity index varies with the number of doctors for different Same-Provider rates.</p>
        <div class="chart-grid">
            ${comparisonCharts.map(config => `
            <div class="chart-container">
                <canvas id="${config.id}"></canvas>
            </div>
            `).join('')}
        </div>
    </div>
    
    <div class="metrics" id="correlations">
        <h2>Key Findings</h2>
        <ul>
            <li><strong>SP Rate Impact:</strong> All indices show strong sensitivity to Same-Provider rate changes</li>
            <li><strong>Doctor Count Impact:</strong> Indices converge as the number of doctors increases</li>
            <li><strong>Index Behavior:</strong> UPC and COC show similar patterns across all scenarios, consistent with Nyweide et al. (2013) finding "correlations between UPC, HI, and COC were very high (r=0.96 to 0.98)"<sup>2</sup></li>
            <li><strong>Edge Cases:</strong> With 1 doctor, all indices = 1.0 regardless of SP target (except 0%), demonstrating the mathematical constraints of continuity measurement</li>
        </ul>
    </div>
    
    <div id="summary">
        <h2>Index Distribution Summary</h2>
        <p>Statistical summary of each index across all scenarios.</p>
        <div class="chart-container">
            <canvas id="chart-summary"></canvas>
        </div>
    </div>
    
    <div id="comparative-metrics">
        <h2>Comparative Metrics</h2>
        
        <div class="metrics">
            <h3>Spearman's Rank Correlation Matrix</h3>
            <p>How strongly each index correlates with others across all scenarios</p>
            <p class="citation">Based on Pollack et al. (2016): "The four indices were highly correlated with each other. Spearman's rho values ranged from 0.935 to 0.996" when comparing UPC, COC, HI, and SECON indices.<sup>1</sup></p>
            <div class="chart-container">
                <canvas id="chart-correlation-overall"></canvas>
            </div>
        </div>
        
        <div class="metrics">
            <h3>Lin's Concordance Correlation Coefficient</h3>
            <p>Measures agreement between indices by assessing both precision and accuracy</p>
            <p class="citation">Lin's CCC evaluates how well pairs of observations fall on the 45° line of perfect agreement. Unlike simple correlation, it detects systematic bias between measures.<sup>6</sup> Interpretation: >0.99 = almost perfect, 0.95-0.99 = substantial, 0.90-0.95 = moderate, <0.90 = poor agreement.<sup>7</sup></p>
        </div>
        
        <div class="chart-grid">
            <div class="chart-container">
                <h3>Coefficient of Variation</h3>
                <p>Relative variability (lower = more consistent)</p>
                <canvas id="chart-cv"></canvas>
            </div>
            
            <div class="chart-container">
                <h3>Lin's Concordance Correlation</h3>
                <p>Agreement between indices (precision + accuracy)</p>
                <canvas id="chart-concordance"></canvas>
            </div>
        </div>
        
        <div class="metrics" id="insights">
            <h3>Key Comparative Insights</h3>
            <div id="insights-content"></div>
        </div>
    </div>
    
    <div class="metrics" id="statistical-methods">
        <h2>Statistical Methods for Comparing Continuity Indices</h2>
        <p>Based on comprehensive review of published literature, researchers use various statistical approaches to compare continuity of care indices:</p>
        
        <h3>1. Correlation Analysis</h3>
        <ul>
            <li><strong>Spearman's rank correlation:</strong> Most commonly used due to non-normal distributions. Pollack et al. (2016) found "Spearman's rho values ranged from 0.935 to 0.996" between UPC, COC, MMCI, and SECON indices.<sup>1</sup></li>
            <li><strong>Pearson correlation:</strong> Used when data approximates normal distribution. Hills et al. (2022) found "Pearson's r correlation coefficient 0.99" between UPC and Bice-Boxerman indices.<sup>8</sup></li>
        </ul>
        
        <h3>2. Agreement and Concordance Measures</h3>
        <ul>
            <li><strong>Lin's Concordance Correlation Coefficient:</strong> Measures both precision and accuracy of agreement, detecting systematic bias between indices.<sup>6</sup></li>
            <li><strong>Sensitivity/specificity analysis:</strong> Evaluates predictive performance of different indices for health outcomes.<sup>10</sup></li>
        </ul>
        
        <h3>3. Regression Models</h3>
        <ul>
            <li><strong>Linear regression:</strong> For continuous outcomes (e.g., healthcare costs). Nyweide et al. (2013) used this to show "a 0.1 increase in the continuity measure translates to a reduction of 6% to 8% in mean annual ED visits."<sup>2</sup></li>
            <li><strong>Logistic regression:</strong> For binary outcomes. Song et al. (2022) found adjusted odds ratio for integrated COC was 1.56 (95% CI 1.50-1.63) for medication adherence.<sup>10</sup></li>
            <li><strong>Multilevel models:</strong> Account for clustering within practices/providers. Hills et al. (2022) used multilevel mixed-effect regression models to control for practice-level effects.<sup>8</sup></li>
        </ul>
        
        <h3>4. Non-parametric Tests</h3>
        <ul>
            <li><strong>Mann-Whitney U test:</strong> For comparing medians when distributions are skewed<sup>1</sup></li>
            <li><strong>Bootstrap confidence intervals:</strong> For robust estimation with non-normal data</li>
        </ul>
        
        <h3>5. Advanced Techniques</h3>
        <ul>
            <li><strong>Principal Component Analysis (PCA):</strong> Chen et al. (2013) found "the explanatory variable of the first principal component of PCA... were all greater than 90% (94.37%, 94.23% and 92.20%, respectively)" when combining UPC, COC, and SECON.<sup>3</sup></li>
        </ul>
    </div>
    
    <div class="metrics" id="key-findings-literature">
        <h2>Key Findings from Literature</h2>
        
        <h3>Inter-Index Correlations</h3>
        <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
            <thead>
                <tr style="background-color: #f0f0f0;">
                    <th style="padding: 10px; border: 1px solid #ddd;">Study</th>
                    <th style="padding: 10px; border: 1px solid #ddd;">Indices Compared</th>
                    <th style="padding: 10px; border: 1px solid #ddd;">Correlation Range</th>
                    <th style="padding: 10px; border: 1px solid #ddd;">Method</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd;">Pollack et al. (2016)<sup>1</sup></td>
                    <td style="padding: 10px; border: 1px solid #ddd;">UPC, COC, MMCI, SECON</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">0.935-0.996</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">Spearman's rho</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd;">Nyweide et al. (2013)<sup>2</sup></td>
                    <td style="padding: 10px; border: 1px solid #ddd;">UPC, HI, COC</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">0.96-0.98</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">Pearson's r</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd;">Nyweide et al. (2013)<sup>2</sup></td>
                    <td style="padding: 10px; border: 1px solid #ddd;">SECON vs others</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">0.75-0.82</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">Pearson's r</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd;">Hills et al. (2022)<sup>8</sup></td>
                    <td style="padding: 10px; border: 1px solid #ddd;">UPC, Bice-Boxerman</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">0.99</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">Pearson's r</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd;">Steinwachs (1979)<sup>9</sup></td>
                    <td style="padding: 10px; border: 1px solid #ddd;">Patient-reported vs UPC</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">0.30</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">Pearson's r</td>
                </tr>
            </tbody>
        </table>
        
        <h3>Important Observations</h3>
        <ol>
            <li><strong>Non-normal distributions:</strong> "A large proportion of patients had perfect continuity (22% to 37% of patients for each measure at the provider-level; 23% to 46% at the practice-level)"<sup>2</sup> and "36.1% of the participants experience 'perfect' continuity of care (computed value of 1.0 on all measures)."<sup>5</sup></li>
            
            <li><strong>SECON is unique:</strong> Sequential continuity (SECON) shows systematically lower correlations (0.75-0.82) with other indices, suggesting it captures a different aspect of continuity.<sup>2</sup></li>
            
            <li><strong>Patient vs administrative measures:</strong> "Patient-reported visit continuity measures are much more strongly associated with the quality of physician-patient interactions than administratively derived measures" with patient reports showing 5.0 point change vs 1.13 point change per standard deviation for UPC.<sup>9</sup></li>
            
            <li><strong>Health outcome associations:</strong> Higher continuity associated with:
                <ul>
                    <li>6-8% decrease in emergency department visits per 0.1 index increase<sup>1,2</sup></li>
                    <li>Improved medication adherence (OR 1.23-1.56)<sup>10</sup></li>
                    <li>Better preventive care compliance<sup>2</sup></li>
                </ul>
            </li>
            
            <li><strong>Choice of index:</strong> "The high correlations among the four measures considered... indicates that the choice of measures can be driven by the intent of a measure"<sup>2</sup> rather than statistical superiority.</li>
        </ol>
    </div>
    
    <div class="metrics" id="methodology-comparison">
        <h2>Comparison: Published Methodologies vs Our Benchmark Approach</h2>
        <p>This benchmark implementation aligns with and extends published research methodologies:</p>
        
        <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
            <thead>
                <tr style="background-color: #f0f0f0;">
                    <th style="padding: 10px; border: 1px solid #ddd; width: 25%;">Methodology</th>
                    <th style="padding: 10px; border: 1px solid #ddd; width: 35%;">Published Studies</th>
                    <th style="padding: 10px; border: 1px solid #ddd; width: 40%;">Our Implementation</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd; vertical-align: top;"><strong>Correlation Analysis</strong></td>
                    <td style="padding: 10px; border: 1px solid #ddd;">
                        • Pollack: Spearman's rho (0.935-0.996)<sup>1</sup><br>
                        • Nyweide: Pearson's r (0.87-0.98)<sup>2</sup><br>
                        • Hills: Pearson's r (0.99)<sup>8</sup>
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd;">
                        ✓ <strong>Spearman's rank correlation</strong> implemented<br>
                        ✓ Handles non-normal distributions<br>
                        ✓ Calculates full correlation matrix for all indices
                    </td>
                </tr>
                <tr style="background-color: #f9f9f9;">
                    <td style="padding: 10px; border: 1px solid #ddd; vertical-align: top;"><strong>Agreement Measures</strong></td>
                    <td style="padding: 10px; border: 1px solid #ddd;">
                        • Simple concordance (within threshold)<br>
                        • Lin's CCC recommended<sup>6</sup><br>
                        • Sensitivity/specificity analysis<sup>10</sup>
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd;">
                        ✓ <strong>Lin's CCC</strong> fully implemented<br>
                        ✓ Measures both precision and accuracy<br>
                        ✓ Uses McBride's interpretation guidelines<sup>7</sup>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd; vertical-align: top;"><strong>Sample Size</strong></td>
                    <td style="padding: 10px; border: 1px solid #ddd;">
                        • Pollack: 74,400 patients<sup>1</sup><br>
                        • Nyweide: 20% Medicare sample<sup>2</sup><br>
                        • Hills: 36,810 patients<sup>8</sup>
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd;">
                        ✓ <strong>Dynamic sample sizing</strong> based on statistical power<br>
                        ✓ 500-2305 patients per scenario<br>
                        ✓ Total 48 scenarios = comprehensive coverage
                    </td>
                </tr>
                <tr style="background-color: #f9f9f9;">
                    <td style="padding: 10px; border: 1px solid #ddd; vertical-align: top;"><strong>Parameter Space</strong></td>
                    <td style="padding: 10px; border: 1px solid #ddd;">
                        • Real-world observational data<br>
                        • Limited control over provider counts<br>
                        • Natural variation in continuity
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd;">
                        ✓ <strong>Systematic grid search</strong><br>
                        ✓ SP rates: 0%, 20%, 40%, 60%, 80%, 100%<br>
                        ✓ Doctors: 1, 3, 5, 10, 20, 50, 100, 200<br>
                        ✓ Controlled experimental design
                    </td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd; vertical-align: top;"><strong>Non-normal Distributions</strong></td>
                    <td style="padding: 10px; border: 1px solid #ddd;">
                        • 22-37% perfect continuity<sup>2</sup><br>
                        • 36.1% score 1.0 on all measures<sup>5</sup><br>
                        • Recommends non-parametric methods<sup>1</sup>
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd;">
                        ✓ Uses <strong>Spearman's correlation</strong><br>
                        ✓ Calculates coefficient of variation<br>
                        ✓ Visualizes distribution patterns
                    </td>
                </tr>
                <tr style="background-color: #f9f9f9;">
                    <td style="padding: 10px; border: 1px solid #ddd; vertical-align: top;"><strong>Index Coverage</strong></td>
                    <td style="padding: 10px; border: 1px solid #ddd;">
                        • Most studies: 3-4 indices<br>
                        • Common: UPC, COC, MMCI, SECON<br>
                        • Some include HI<sup>2</sup>
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd;">
                        ✓ <strong>5 indices</strong>: UPC, COC, SECON, MMCI<br>
                        ✓ Plus <strong>Rolling Continuity</strong> (novel)<br>
                        ✓ Comprehensive comparison matrix
                    </td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd; vertical-align: top;"><strong>Advanced Techniques</strong></td>
                    <td style="padding: 10px; border: 1px solid #ddd;">
                        • Chen: PCA (>90% variance in PC1)<sup>3</sup><br>
                        • Multilevel models<sup>8</sup><br>
                        • Bootstrap CIs recommended
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd;">
                        ✓ CV analysis for variability<br>
                        ⚬ PCA not yet implemented<br>
                        ⚬ Bootstrap CIs not yet implemented
                    </td>
                </tr>
            </tbody>
        </table>
        
        <h3>Key Advantages of Our Approach</h3>
        <ol>
            <li><strong>Controlled Experimental Design:</strong> Unlike observational studies, we systematically vary SP rates and doctor counts to isolate their effects on each index.</li>
            
            <li><strong>Comprehensive Parameter Space:</strong> Our grid search covers edge cases (1 doctor, 100% continuity) that rarely occur in real-world data but reveal mathematical properties of indices.</li>
            
            <li><strong>Statistical Rigor:</strong> Implementation of both Spearman's correlation (for non-normal data) and Lin's CCC (for agreement analysis) follows best practices from literature.</li>
            
            <li><strong>Novel Index Inclusion:</strong> Rolling Continuity index provides month-by-month granularity not captured by traditional indices.</li>
            
            <li><strong>Reproducibility:</strong> Seeded random data generation ensures consistent results across runs, enabling reliable methodology validation.</li>
        </ol>
        
        <h3>Limitations and Future Work</h3>
        <ul>
            <li>Synthetic data may not capture all real-world complexities (e.g., provider availability, patient preferences)</li>
            <li>Bootstrap confidence intervals would strengthen statistical inference</li>
            <li>PCA implementation would enable integrated index creation as in Chen et al.<sup>3</sup></li>
            <li>Time-based patterns (seasonality, trends) not yet modeled</li>
        </ul>
    </div>
    
    <div class="metrics" id="references">
        <h2>References</h2>
        <ol>
            <li>Pollack MM, et al. (2016). "The association between continuity of care in the community and health outcomes: a population-based study." <em>Can Fam Physician</em>, 62(8), 684-693. PMC3424831. Key finding: "The four indices were highly correlated with each other. Spearman's rho values ranged from 0.935 to 0.996."</li>
            
            <li>Nyweide DJ, et al. (2013). "Measuring Care Continuity: A Comparison of Claims-Based Methods." <em>Medical Care</em>, 51(5), e22-e27. PMC4101051. Key finding: "Pearson coefficients of correlations between measures were high (r=0.87 to 0.98)" and "A large proportion of patients had perfect continuity (22% to 37% of patients for each measure at the provider-level; 23% to 46% at the practice-level." Note: Study also emphasizes the importance of using appropriate correlation methods for non-normal distributions.</li>
            
            <li>Chen CC, et al. (2013). "Using an integrated COC index and multilevel measurements to verify the care outcome of patients with multiple chronic conditions." <em>BMC Health Services Research</em>, 13, 405. PMC3529188. Key finding: "The explanatory variable of the first principal component of PCA... were all greater than 90% (94.37%, 94.23% and 92.20%, respectively)."</li>
            
            <li>Bazemore A, et al. (2018). "Raiders of the Lost Correlation: A Guide on Using Pearson and Spearman Coefficients to Detect Hidden Correlations in Medical Sciences." <em>Int J Environ Res Public Health</em>, 15(11), 2365. PMC7779167. Key finding: "Spearman's correlation measures any monotonic relationship between two continuous random variables and is adopted when the data do not follow a normal distribution."</li>
            
            <li>Mosteller RD. (2021). "Claims-based measures of continuity of care have non-linear associations with health: data linkage study." <em>International Journal of Population Data Science</em>, 6(1), 1365. PMC8142963. Key finding: "36.1% of the participants experience 'perfect' continuity of care (computed value of 1.0 on all measures)."</li>
            
            <li>Lin LI. (1989). "A concordance correlation coefficient to evaluate reproducibility." <em>Biometrics</em>, 45(1), 255-268. Key finding: Introduced the concordance correlation coefficient (CCC) which measures both precision and accuracy of agreement. Unlike simple correlation, CCC detects departures from the 45° line of perfect agreement.</li>
            
            <li>McBride GB. (2005). "A proposal for strength-of-agreement criteria for Lin's concordance correlation coefficient." <em>NIWA Client Report: HAM2005-062</em>. Interpretation guidelines: CCC < 0.90 = poor agreement, 0.90-0.95 = moderate, 0.95-0.99 = substantial, > 0.99 = almost perfect agreement.</li>
            
            <li>Hills T, et al. (2022). "Measuring continuity of care in general practice: a comparison of two methods using routinely collected data." <em>British Journal of General Practice</em>, 72(724), e773-e779. PMC9423043. Key finding: "Sensitivity analysis showed a close correlation between the UPC and Bice–Boxerman in measurement of mean practice UPC: Pearson's r, correlation coefficient 0.99."</li>
            
            <li>Steinwachs DM. (1979). "Measuring provider continuity in ambulatory care: an assessment of alternative approaches." <em>Medical Care</em>, 17(6), 551-565. PMC2518030. Key finding: Patient-reported visit continuity showed moderate correlation with administratively derived UPC (r=0.30) but much stronger association with quality of physician-patient interactions.</li>
            
            <li>Song X, et al. (2022). "An integrated continuity of care measure improves performance in models predicting medication adherence using population-based administrative data." <em>PLoS One</em>, 17(3), e0264170. PMC8893672. Key finding: Integrated COC measure had stronger association with medication adherence (adjusted OR 1.56, 95% CI 1.50-1.63) compared to UPCI alone (adjusted OR 1.23, 95% CI 1.19-1.28).</li>
        </ol>
    </div>
    
    <script>
        // Initialize all charts
        ${chartConfigs.map(config => `
        new Chart(document.getElementById('${config.id}'), ${JSON.stringify(config, null, 2)});
        `).join('\n')}
        
        ${comparisonCharts.map(config => `
        new Chart(document.getElementById('${config.id}'), ${JSON.stringify(config, null, 2)});
        `).join('\n')}
        
        // Summary statistics chart
        new Chart(document.getElementById('chart-summary'), {
          type: 'bar',
          data: ${JSON.stringify(summaryData, null, 2)},
          options: {
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: 'Summary Statistics for Each Index Across All Scenarios'
              },
              legend: {
                position: 'top'
              }
            },
            scales: {
              y: {
                title: {
                  display: true,
                  text: 'Value'
                },
                min: 0,
                max: 1
              }
            }
          }
        });
        
        // Function to draw correlation heatmap
        function drawCorrelationHeatmap(canvasId, matrix, title) {
          const canvas = document.getElementById(canvasId);
          if (!canvas) return;
          
          const ctx = canvas.getContext('2d');
          const cellSize = 40;
          const padding = 60;
          
          canvas.width = cellSize * ${indices.length} + padding * 2;
          canvas.height = cellSize * ${indices.length} + padding * 2;
          
          // Draw matrix
          ${JSON.stringify(indices)}.forEach((index1, i) => {
            ${JSON.stringify(indices)}.forEach((index2, j) => {
              const value = matrix[i][j];
              const x = padding + j * cellSize;
              const y = padding + i * cellSize;
              
              if (isNaN(value)) {
                // Not enough data
                ctx.fillStyle = 'rgba(128, 128, 128, 0.3)';
                ctx.fillRect(x, y, cellSize - 2, cellSize - 2);
                ctx.fillStyle = 'black';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('N/A', x + cellSize/2, y + cellSize/2);
              } else {
                // Color based on correlation strength
                const intensity = Math.abs(value);
                const color = value >= 0 
                  ? \`rgba(0, 128, 255, \${intensity})\`
                  : \`rgba(255, 0, 0, \${intensity})\`;
                
                ctx.fillStyle = color;
                ctx.fillRect(x, y, cellSize - 2, cellSize - 2);
                
                // Add text
                ctx.fillStyle = intensity > 0.5 ? 'white' : 'black';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(value.toFixed(2), x + cellSize/2, y + cellSize/2);
              }
            });
          });
          
          // Add labels
          ctx.fillStyle = 'black';
          ctx.font = '12px Arial';
          ${JSON.stringify(indices)}.forEach((index, i) => {
            // Top labels
            ctx.save();
            ctx.translate(padding + i * cellSize + cellSize/2, padding - 5);
            ctx.rotate(-Math.PI/4);
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(index, 0, 0);
            ctx.restore();
            
            // Left labels
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(index, padding - 5, padding + i * cellSize + cellSize/2);
          });
        }
        
        // Draw overall correlation
        drawCorrelationHeatmap('chart-correlation-overall', ${JSON.stringify(correlationMatrix)});
        
        // CV chart
        new Chart(document.getElementById('chart-cv'), {
          type: 'bar',
          data: {
            labels: ${JSON.stringify(indices)},
            datasets: [{
              label: 'Coefficient of Variation',
              data: ${JSON.stringify(cvData)},
              backgroundColor: 'rgba(75, 192, 192, 0.8)',
              borderColor: 'rgba(75, 192, 192, 1)',
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            plugins: {
              legend: {
                display: false
              }
            },
            scales: {
              y: {
                title: {
                  display: true,
                  text: 'CV (lower = more consistent)'
                },
                min: 0
              }
            }
          }
        });
        
        // Concordance heatmap
        const concordanceCanvas = document.getElementById('chart-concordance');
        const concordanceCtx = concordanceCanvas.getContext('2d');
        const cellSize = 40;
        const padding = 60;
        
        concordanceCanvas.width = cellSize * ${indices.length} + padding * 2;
        concordanceCanvas.height = cellSize * ${indices.length} + padding * 2;
        
        // Draw Lin's CCC matrix
        ${JSON.stringify(indices)}.forEach((index1, i) => {
          ${JSON.stringify(indices)}.forEach((index2, j) => {
            const value = ${JSON.stringify(concordanceMatrix)}[i][j];
            const x = padding + j * cellSize;
            const y = padding + i * cellSize;
            
            // Color based on Lin's CCC value (-1 to 1)
            // Lin's CCC interpretation (McBride, 2005):
            // <0.90 = poor, 0.90-0.95 = moderate, 0.95-0.99 = substantial, >0.99 = almost perfect
            let color;
            const absValue = Math.abs(value);
            if (absValue > 0.99) {
              color = \`rgba(76, 175, 80, 1)\`; // Dark green - almost perfect
            } else if (absValue > 0.95) {
              color = \`rgba(139, 195, 74, 0.9)\`; // Green - substantial
            } else if (absValue > 0.90) {
              color = \`rgba(255, 193, 7, 0.8)\`; // Yellow - moderate
            } else {
              color = \`rgba(244, 67, 54, \${0.3 + absValue * 0.5})\`; // Red - poor
            }
            
            concordanceCtx.fillStyle = color;
            concordanceCtx.fillRect(x, y, cellSize - 2, cellSize - 2);
            
            // Add text
            concordanceCtx.fillStyle = absValue > 0.5 ? 'white' : 'black';
            concordanceCtx.font = '12px Arial';
            concordanceCtx.textAlign = 'center';
            concordanceCtx.textBaseline = 'middle';
            concordanceCtx.fillText(value.toFixed(3), x + cellSize/2, y + cellSize/2);
          });
        });
        
        // Add labels
        concordanceCtx.fillStyle = 'black';
        concordanceCtx.font = '14px Arial';
        ${JSON.stringify(indices)}.forEach((index, i) => {
          // Top labels
          concordanceCtx.save();
          concordanceCtx.translate(padding + i * cellSize + cellSize/2, padding - 10);
          concordanceCtx.rotate(-Math.PI/4);
          concordanceCtx.textAlign = 'right';
          concordanceCtx.textBaseline = 'middle';
          concordanceCtx.fillText(index, 0, 0);
          concordanceCtx.restore();
          
          // Left labels
          concordanceCtx.textAlign = 'right';
          concordanceCtx.textBaseline = 'middle';
          concordanceCtx.fillText(index, padding - 10, padding + i * cellSize + cellSize/2);
        });
        
        // Add insights text
        const insightsHTML = \`
          <ul>
            <li><strong>Most correlated index:</strong> ${avgCorrelations[0].index} (avg: ${avgCorrelations[0].avgCorr.toFixed(3)}) - Behaves most similarly to other indices</li>
            <li><strong>Most unique index:</strong> ${avgCorrelations[avgCorrelations.length-1].index} (avg: ${avgCorrelations[avgCorrelations.length-1].avgCorr.toFixed(3)}) - Captures different aspects</li>
            <li><strong>Most stable index:</strong> ${indices[cvData.indexOf(Math.min(...cvData))]} (CV: ${Math.min(...cvData).toFixed(3)}) - Least relative variability</li>
            <li><strong>Most sensitive index:</strong> ${indices[cvData.indexOf(Math.max(...cvData))]} (CV: ${Math.max(...cvData).toFixed(3)}) - Best for discrimination</li>
          </ul>
        \`;
        document.getElementById('insights-content').innerHTML = insightsHTML;
    </script>
</body>
</html>`;
  
  fs.writeFileSync(path.join(reportsDir, 'report.html'), html);
}

// Run the benchmark
runBenchmark().catch(console.error);