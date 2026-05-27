import { cn } from '../lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

const CustomSelect = ({ value, onChange, options, placeholder = "Select option", className }) => {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("w-full md:w-auto min-w-[160px]", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default CustomSelect;
