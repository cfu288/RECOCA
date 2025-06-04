import * as React from "react";

interface SearchInputProps {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  placeholder,
  value,
  onChange,
  className = "",
}) => {
  return (
    <input
      type="text"
      placeholder={placeholder}
      className={`w-full px-3 py-2 border rounded-md ${className}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
};
