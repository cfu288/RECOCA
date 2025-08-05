import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Label,
} from "recharts";

interface RollingContChartProps {
  monthlyScores: Record<string, number>;
  title?: string;
}

/**
 * Component that renders a line chart showing the rolling continuity trend over time
 */
export const RollingContChart: React.FC<RollingContChartProps> = React.memo(({
  monthlyScores,
  title = "Rolling Continuity of Care",
}) => {
  // Process the monthly scores data
  const months = Object.keys(monthlyScores).sort();
  
  // Skip rendering if we have no data
  if (months.length === 0) {
    return (
      <div className="text-center p-4 bg-gray-50 rounded border">
        <p className="text-gray-500">No rolling continuity data available</p>
      </div>
    );
  }
  
  // Format month labels (YYYY-MM or YYYY-MM-DD) to more readable format
  const formatMonthLabel = (monthStr: string): string => {
    const parts = monthStr.split("-");
    if (parts.length === 2) {
      // YYYY-MM format
      const year = parts[0];
      const month = parseInt(parts[1], 10);
      return new Date(parseInt(year), month - 1, 1).toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      });
    } else if (parts.length === 3) {
      // YYYY-MM-DD format (custom boundaries)
      const year = parts[0];
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      return `${month}/${day}/${year.slice(2)}`;
    }
    return monthStr; // fallback
  };

  // Convert the scores to data for recharts
  const data = months.map((month) => ({
    month: formatMonthLabel(month),
    originalMonth: month,
    score: monthlyScores[month] * 100, // Convert to percentage
  }));

  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const monthData = payload[0].payload;
      
      return (
        <div className="bg-white p-2 border rounded shadow-sm">
          <p className="font-medium">{monthData.month}</p>
          <p>{monthData.score.toFixed(1)}% continuity</p>
        </div>
      );
    }
    return null;
  };
  
  return (
    <div className="w-full h-80">
      <h3 className="text-center font-medium mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 40 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis 
            dataKey="month" 
            padding={{ left: 20, right: 20 }}
          >
            <Label value="Month" offset={-5} position="insideBottom" />
          </XAxis>
          <YAxis 
            domain={[0, 100]} 
            tickFormatter={(value) => `${value}%`}
          >
            <Label value="Continuity %" angle={-90} position="insideLeft" style={{ textAnchor: 'middle' }} />
          </YAxis>
          <Tooltip content={<CustomTooltip />} />
          <Line 
            type="monotone" 
            dataKey="score" 
            stroke="#8884d8" 
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            name="Continuity"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});