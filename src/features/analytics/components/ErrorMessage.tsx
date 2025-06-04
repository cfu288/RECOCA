import * as React from "react";

interface TroubleshootingTip {
  content: React.ReactNode;
}

interface ErrorMessageProps {
  message: string;
  tips: TroubleshootingTip[];
  type?: "error" | "warning";
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  message,
  tips,
  type = "error",
}) => {
  const colorClasses = {
    error: {
      text: "text-red-500",
      bg: "bg-red-50",
      border: "border-red-200",
    },
    warning: {
      text: "text-amber-500",
      bg: "bg-amber-50",
      border: "border-amber-200",
    },
  };

  const colors = colorClasses[type];

  return (
    <div className="text-gray-500">
      <p className={`mb-2 ${colors.text}`}>{message}</p>
      <div
        className={`text-xs ${colors.bg} p-3 rounded border ${colors.border}`}
      >
        <p className="font-medium mb-1">
          {type === "error" ? "Try the following:" : "Troubleshooting:"}
        </p>
        <ul className="list-disc pl-5 space-y-1">
          {tips.map((tip, index) => (
            <li key={index}>{tip.content}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};
