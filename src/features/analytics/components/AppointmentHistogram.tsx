import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Label,
} from "recharts";

interface AppointmentHistogramProps {
  distribution: Record<string, number>;
  title?: string;
}

/**
 * Histogram visualization showing patient distribution by appointment count
 */
export const AppointmentHistogram: React.FC<AppointmentHistogramProps> = ({
  distribution,
  title = "Appointment Distribution",
}) => {
  const data = Object.entries(distribution)
    .map(([appointmentCount, patientCount]) => ({
      appointmentCount: parseInt(appointmentCount),
      patientCount,
    }))
    .sort((a, b) => a.appointmentCount - b.appointmentCount);

  const totalPatients = data.reduce(
    (total, item) => total + item.patientCount,
    0
  );
  const maxAppointments = Math.max(
    ...data.map((item) => item.appointmentCount)
  );

  if (data.length === 0) {
    return (
      <div className="text-center p-4 bg-gray-50 rounded border">
        <p className="text-gray-500">No appointment data available</p>
      </div>
    );
  }

  /**
   * Calculates appropriate tick values for the X-axis based on data range
   */
  const getXAxisTicks = () => {
    if (maxAppointments <= 10) {
      return Array.from({ length: maxAppointments + 1 }, (_, i) => i);
    } else if (maxAppointments <= 20) {
      return Array.from(
        { length: Math.ceil((maxAppointments + 1) / 2) },
        (_, i) => i * 2
      );
    } else {
      const step = Math.ceil(maxAppointments / 5);
      return Array.from({ length: 6 }, (_, i) => i * step);
    }
  };

  /**
   * Custom tooltip component showing patient count and percentage
   */
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percentage = ((data.patientCount / totalPatients) * 100).toFixed(1);

      return (
        <div className="bg-white p-2 border rounded shadow-sm">
          <p className="font-medium">{data.appointmentCount} Appointments</p>
          <p>
            {data.patientCount} patients ({percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-80">
      <h3 className="text-center font-medium mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height="90%">
        <BarChart
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 40 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="appointmentCount" ticks={getXAxisTicks()}>
            <Label
              value="Number of Appointments"
              offset={-5}
              position="insideBottom"
            />
          </XAxis>
          <YAxis>
            <Label
              value="Number of Patients"
              angle={-90}
              position="insideLeft"
              style={{ textAnchor: "middle" }}
            />
          </YAxis>
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="patientCount" fill="#8884d8" name="Patients" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
