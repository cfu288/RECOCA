import * as React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../../shared/components/ui/card";
import { AppointmentHistogram } from "./AppointmentHistogram";
import {
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { CHART_COLORS } from "../../../core/data/processors/provider-patient-demographics";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../shared/components/ui/collapsible";
import { ChevronDown, ChevronUp } from "lucide-react";

interface ProcessingStatistics {
  appliedFilters: Array<{ field: string; values: string[] }>;
  filtered: {
    uniqueResidents: number;
    uniquePatients: number;
    totalAppointments?: number;
    upcIndex?: number;
    cocIndex?: number;
    seconIndex?: number;
    mmciIndex?: number;
    topProviders?: Record<string, Record<string, number>>;
    appointmentCountDistribution?: Record<string, number>;
  };
  total: {
    uniqueResidents: number;
    uniquePatients: number;
    totalAppointments?: number;
    upcIndex?: number;
    cocIndex?: number;
    seconIndex?: number;
    mmciIndex?: number;
    appointmentCountDistribution?: Record<string, number>;
  };
}

interface DemographicData {
  race?: Record<string, number>;
  gender?: Record<string, number>;
}

interface StatisticsPanelProps {
  statistics: ProcessingStatistics;
  demographicData?: DemographicData;
}

export const StatisticsPanel: React.FC<StatisticsPanelProps> = ({
  statistics,
  demographicData,
}) => {
  const toTileCase = (fieldName: string) => {
    return fieldName
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase());
  };

  const formatFilterDisplayValue = (filter: {
    field: string;
    values: string[];
  }) => {
    if (filter.values.length === 0) return "None selected";

    if (statistics?.total) {
      const totalUniqueCount = filter.field.includes("resident")
        ? statistics.total.uniqueResidents
        : undefined;
      if (totalUniqueCount === filter.values.length) {
        return "All";
      }
    }

    if (filter.values.length > 5) {
      return `${filter.values.length} selected`;
    }

    return filter.values.join(", ");
  };

  const formatUpcIndex = (index?: number) => {
    if (index === undefined) return "Not calculated";
    return (index * 100).toFixed(2) + "%";
  };

  const formatCocIndex = (index?: number) => {
    if (index === undefined) return "Not calculated";
    return (index * 100).toFixed(2) + "%";
  };

  const formatSeconIndex = (index?: number) => {
    if (index === undefined) return "Not calculated";
    return (index * 100).toFixed(2) + "%";
  };

  const formatMmciIndex = (index?: number) => {
    if (index === undefined) return "Not calculated";
    return (index * 100).toFixed(2) + "%";
  };

  const [patientRaceData, setPatientRaceData] = React.useState<
    Array<{ name: string; value: number; fill: string }>
  >([]);
  const [patientGenderData, setPatientGenderData] = React.useState<
    Array<{ name: string; value: number; fill: string }>
  >([]);
  const [isRaceCollapsibleOpen, setIsRaceCollapsibleOpen] = React.useState(
    false
  );

  const updateDemographicData = () => {
    if (!demographicData) {
      setPatientRaceData([
        {
          name: "No Race Data",
          value: 1,
          fill: CHART_COLORS[CHART_COLORS.length - 1],
        },
      ]);

      setPatientGenderData([
        {
          name: "No Gender Data",
          value: 1,
          fill: CHART_COLORS[CHART_COLORS.length - 1],
        },
      ]);
      return;
    }

    if (demographicData.race && Object.keys(demographicData.race).length > 0) {
      const sortedRaceEntries = Object.entries(demographicData.race).sort(
        (a, b) => b[1] - a[1]
      );

      const raceChartData = sortedRaceEntries.map(([name, value], index) => ({
        name,
        value,
        fill: CHART_COLORS[index % CHART_COLORS.length],
      }));

      setPatientRaceData(raceChartData);
    } else {
      setPatientRaceData([
        {
          name: "No Race Data",
          value: 1,
          fill: CHART_COLORS[CHART_COLORS.length - 1],
        },
      ]);
    }

    if (
      demographicData.gender &&
      Object.keys(demographicData.gender).length > 0
    ) {
      const sortedGenderEntries = Object.entries(demographicData.gender).sort(
        (a, b) => b[1] - a[1]
      );

      const genderChartData = sortedGenderEntries.map(
        ([name, value], index) => ({
          name,
          value,
          fill: CHART_COLORS[index % CHART_COLORS.length],
        })
      );

      setPatientGenderData(genderChartData);
    } else {
      setPatientGenderData([
        {
          name: "No Gender Data",
          value: 1,
          fill: CHART_COLORS[CHART_COLORS.length - 1],
        },
      ]);
    }
  };

  React.useEffect(() => {
    updateDemographicData();
  }, [demographicData, statistics]);

  return (
    <div className="space-y-6 pt-4">
      {statistics.appliedFilters.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Applied Filters For this Calculation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {statistics.appliedFilters.map((filter, index) => (
                <div
                  key={index}
                  className="border-b pb-3 last:border-b-0 last:pb-0"
                >
                  <p className="text-sm font-medium text-gray-500">
                    {toTileCase(filter.field)}
                  </p>
                  <div className="mt-1">
                    <p className="text-sm">
                      {formatFilterDisplayValue(filter)}
                    </p>
                    {filter.values.length > 5 && (
                      <details className="mt-2">
                        <summary className="text-xs text-primary cursor-pointer">
                          Show all selected values
                        </summary>
                        <div className="mt-2 pl-4 text-sm max-h-40 overflow-y-auto">
                          <ul className="list-disc pl-4">
                            {filter.values.map((value, idx) => (
                              <li key={idx}>{value}</li>
                            ))}
                          </ul>
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Unique Residents</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {statistics.filtered.uniqueResidents}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              out of {statistics.total.uniqueResidents} total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Unique Patients</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {statistics.filtered.uniquePatients}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              out of {statistics.total.uniquePatients} total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Total Appointments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {statistics.filtered.totalAppointments || 0}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              out of {statistics.total.totalAppointments || 0} total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Patient Demographics */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="flex flex-col">
          <CardHeader className="pb-0">
            <CardTitle className="text-lg">Patient Race Distribution</CardTitle>
            <CardDescription>Distribution of patients by race</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-0">
            <div className="overflow-x-auto">
              {patientRaceData.length === 0 ? (
                <div className="text-center p-4 text-gray-500">
                  No race data available
                </div>
              ) : (
                <Collapsible
                  className="w-full"
                  open={isRaceCollapsibleOpen}
                  onOpenChange={setIsRaceCollapsibleOpen}
                >
                  {/* Always visible table with first 5 rows */}
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Race</th>
                        <th className="text-right p-2">Count</th>
                        <th className="text-right p-2">Percentage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {patientRaceData
                        .sort((a, b) => b.value - a.value)
                        .slice(0, 5)
                        .map((entry, index) => {
                          const totalPatients = patientRaceData.reduce(
                            (sum, e) => sum + e.value,
                            0
                          );
                          const percentage =
                            totalPatients > 0
                              ? ((entry.value / totalPatients) * 100).toFixed(1)
                              : "0.0";

                          return (
                            <tr key={index} className="border-b">
                              <td className="p-2">{entry.name}</td>
                              <td className="text-right p-2">{entry.value}</td>
                              <td className="text-right p-2">{percentage}%</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>

                  {patientRaceData.length > 5 && (
                    <div className="flex justify-center mt-2">
                      <CollapsibleTrigger asChild>
                        <button className="flex items-center text-sm text-gray-500 hover:text-gray-700 focus:outline-none py-1 px-2 rounded hover:bg-gray-100">
                          {isRaceCollapsibleOpen ? (
                            <>
                              <span>Show Less</span>
                              <ChevronUp className="h-4 w-4 ml-1" />
                            </>
                          ) : (
                            <>
                              <span>
                                Show {patientRaceData.length - 5} More
                              </span>
                              <ChevronDown className="h-4 w-4 ml-1" />
                            </>
                          )}
                        </button>
                      </CollapsibleTrigger>
                    </div>
                  )}

                  {/* Collapsible content for remaining rows */}
                  <CollapsibleContent>
                    <table className="w-full text-sm">
                      <tbody>
                        {patientRaceData
                          .sort((a, b) => b.value - a.value)
                          .slice(5)
                          .map((entry, index) => {
                            const totalPatients = patientRaceData.reduce(
                              (sum, e) => sum + e.value,
                              0
                            );
                            const percentage =
                              totalPatients > 0
                                ? ((entry.value / totalPatients) * 100).toFixed(
                                    1
                                  )
                                : "0.0";

                            return (
                              <tr key={index} className="border-b">
                                <td className="p-2">{entry.name}</td>
                                <td className="text-right p-2">
                                  {entry.value}
                                </td>
                                <td className="text-right p-2">
                                  {percentage}%
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="items-center pb-0">
            <CardTitle className="text-lg">
              Patient Gender Distribution
            </CardTitle>
            <CardDescription>
              Distribution of patients by gender
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-0">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={patientGenderData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={30}
                    paddingAngle={2}
                    label={(entry) => {
                      const totalValues = patientGenderData.reduce(
                        (sum, e) => sum + e.value,
                        0
                      );
                      const percent = Math.round(
                        (entry.value / totalValues) * 100
                      );
                      return `${percent}%`;
                    }}
                  >
                    {patientGenderData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [
                      `${value} patients (${Math.round(
                        (Number(value) /
                          patientGenderData.reduce(
                            (sum, e) => sum + e.value,
                            0
                          )) *
                          100
                      )}%)`,
                      name,
                    ]}
                    separator=": "
                  />
                  <Legend
                    layout="vertical"
                    verticalAlign="middle"
                    align="right"
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Usual Provider of Care (UPC) Index
          </CardTitle>
          <CardDescription>
            Usual Provider of Care (UPC) Index measures the proportion of a
            patient's visits with their most frequent provider
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">
                Average UPC Index (Filtered Data):
              </p>
              <p className="text-3xl font-bold">
                {formatUpcIndex(statistics.filtered.upcIndex)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Higher values indicate better continuity of care
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Note: Patients with only one visit are excluded from this
                calculation
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Bice-Boxerman Continuity of Care (CoC) Index
            </CardTitle>
            <CardDescription>
              CoC measures continuity of care by weighting both frequency of
              visits to each provider and dispersion of visits. It rewards
              having fewer providers.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Average CoC Index (Filtered Data):
                </p>
                <p className="text-3xl font-bold">
                  {formatCocIndex(statistics.filtered.cocIndex)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Index values range from 0 (each visit to a different provider)
                  to 1 (all visits to same provider)
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Note: Patients with only one visit are excluded from this
                  calculation
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Sequential Continuity of Care (SECON) Index
            </CardTitle>
            <CardDescription>
              SECON measures the sequential nature of provider continuity,
              capturing the frequency of handoffs between providers. Unlike
              other continuity measures, SECON specifically considers the order
              of visits - a patient who alternates between providers will have a
              low score even with equal visit distribution.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Average SECON Index (Filtered Data):
                </p>
                <p className="text-3xl font-bold">
                  {formatSeconIndex(statistics.filtered.seconIndex)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Index values range from 0 (maximum handoffs, each sequential
                  visit to a different provider) to 1 (no handoffs, all
                  sequential visits to the same provider)
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  A patient alternating between providers (ABABA pattern) will
                  have a SECON score of 0, even with a potentially high UPC or
                  CoC index
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Note: Patients with only one visit are excluded from this
                  calculation
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Modified Modified Continuity Index (MMCI)
          </CardTitle>
          <CardDescription>
            MMCI quantifies continuity of care by evaluating the dispersion of
            patient visits among providers, accounting for both the number of
            providers and the number of visits.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">
                Average MMCI Index (Filtered Data):
              </p>
              <p className="text-3xl font-bold">
                {formatMmciIndex(statistics.filtered.mmciIndex)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                MMCI adjusts for the number of visits, providing a more balanced
                measure for patients with fewer visits
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Note: Patients with only one visit are excluded from this
                calculation
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appointment Distribution Histogram */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Patient Appointment Distribution
          </CardTitle>
          <CardDescription>
            Shows the number of patients with each specific appointment count
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statistics.filtered.appointmentCountDistribution ? (
            <AppointmentHistogram
              distribution={statistics.filtered.appointmentCountDistribution}
              title="Number of Patients by Appointment Count"
            />
          ) : (
            <p className="text-gray-500">
              No appointment distribution data available
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
