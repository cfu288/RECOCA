import { Screens } from "../../../app/app";

interface BreadcrumbNavProps {
  currentScreen: Screens;
  onScreenChange: (screen: Screens) => void;
}

export const BreadcrumbNav: React.FC<BreadcrumbNavProps> = ({
  currentScreen,
  onScreenChange,
}) => {
  return (
    <nav className="flex space-x-2 text-sm">
      <button
        onClick={() => onScreenChange("upload")}
        className={`${
          currentScreen === "upload"
            ? "text-primary font-medium"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        Upload File
      </button>
      <span className="text-gray-400">/</span>
      <button
        onClick={() => onScreenChange("column-mapping")}
        className={`${
          currentScreen === "column-mapping"
            ? "text-primary font-medium"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        Column Mapping
      </button>
      <span className="text-gray-400">/</span>
      <button
        onClick={() => onScreenChange("results")}
        className={`${
          currentScreen === "results"
            ? "text-primary font-medium"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        Results
      </button>
    </nav>
  );
};
