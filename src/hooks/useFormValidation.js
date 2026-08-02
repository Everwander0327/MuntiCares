import { useState, useCallback } from 'react';

const RULES = {
  required: (v) => (v && String(v).trim()) ? '' : 'This field is required',
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Enter a valid email address',
  phone: (v) => /^[\d\s\-+()]{7,15}$/.test(v) || 'Enter a valid phone number',
  minLength: (min) => (v) => (v && v.length >= min) || `At least ${min} characters`,
  name: (v) => /^[a-zA-Z\s'-]+$/.test(v) || 'Enter a valid name (letters only)',
};

const useFormValidation = (fields) => {
  const [values, setValues] = useState(() => {
    const initial = {};
    fields.forEach(f => { initial[f.name] = f.default || ''; });
    return initial;
  });

  const [errors, setErrors] = useState(() => {
    const initial = {};
    fields.forEach(f => { initial[f.name] = ''; });
    return initial;
  });

  const [touched, setTouched] = useState(() => {
    const initial = {};
    fields.forEach(f => { initial[f.name] = false; });
    return initial;
  });

  const validateField = useCallback((name, value) => {
    const field = fields.find(f => f.name === name);
    if (!field) return '';
    for (const rule of (field.rules || [])) {
      if (typeof rule === 'function') {
        const result = rule(value);
        if (typeof result === 'string' && result) return result;
        if (result === false) return 'This field is invalid';
      } else if (RULES[rule]) {
        const result = RULES[rule](value);
        if (result === true) continue;
        if (typeof result === 'string' && result) return result;
      }
    }
    return '';
  }, [fields]);

  const handleChange = useCallback((name, value) => {
    setValues(prev => ({ ...prev, [name]: value }));
    if (touched[name]) {
      setErrors(prev => ({ ...prev, [name]: validateField(name, value) }));
    }
  }, [touched, validateField]);

  const handleBlur = useCallback((name) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    setErrors(prev => ({ ...prev, [name]: validateField(name, values[name]) }));
  }, [values, validateField]);

  const validateAll = useCallback(() => {
    const newErrors = {};
    let valid = true;
    const newTouched = {};
    fields.forEach(f => {
      newTouched[f.name] = true;
      const err = validateField(f.name, values[f.name]);
      newErrors[f.name] = err;
      if (err) valid = false;
    });
    setErrors(newErrors);
    setTouched(newTouched);
    return valid;
  }, [fields, values, validateField]);

  const reset = useCallback(() => {
    const initial = {};
    fields.forEach(f => { initial[f.name] = f.default || ''; });
    setValues(initial);
    const emptyErrors = {};
    fields.forEach(f => { emptyErrors[f.name] = ''; });
    setErrors(emptyErrors);
    const notTouched = {};
    fields.forEach(f => { notTouched[f.name] = false; });
    setTouched(notTouched);
  }, [fields]);

  return { values, errors, touched, handleChange, handleBlur, validateAll, reset, setValues };
};

export default useFormValidation;
