export const ACCESS_NEEDS = [
  { value: 'stairs', label: 'Stairs' },
  { value: 'wheelchair', label: 'Wheelchair' },
  { value: 'bedbound', label: 'Bedbound' },
  { value: 'oxygen', label: 'Oxygen' },
  { value: 'hearing', label: 'Hearing' },
  { value: 'vision', label: 'Vision' },
  { value: 'lift', label: 'Needs lift' },
];

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];

export const accessNeedLabel = (value) =>
  ACCESS_NEEDS.find((option) => option.value === value)?.label || value;

export const normalizeAccessNeeds = (list) => {
  if (!Array.isArray(list)) return [];
  const allowed = new Set(ACCESS_NEEDS.map((option) => option.value));
  return [...new Set(list.filter((value) => allowed.has(value)))];
};

export const toggleAccessNeed = (list, value) => {
  const current = normalizeAccessNeeds(list);
  return current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
};
