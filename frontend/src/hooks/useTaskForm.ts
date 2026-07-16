import { useState } from 'react';

import type { Priority, Status, Task } from '../types/task.types';

/**
 * Form state and client-side validation.
 *
 * Client validation provides instant feedback, but the server remains the source
 * of truth for correctness.
 */

export interface TaskFormValues {
  title: string;
  description: string;
  priority: Priority;
  estimatedEffort: string;
  category: string;
  dependencies: string[];
  status: Status;
}

export type FieldErrors = Partial<Record<keyof TaskFormValues, string>>;

const EMPTY_FORM: TaskFormValues = {
  title: '',
  description: '',
  priority: 'Medium',
  estimatedEffort: '1',
  category: '',
  dependencies: [],
  status: 'To Do',
};

/** Builds initial form values from an existing task, or blanks for a new one. */
function toFormValues(task: Task | null): TaskFormValues {
  if (!task) return EMPTY_FORM;

  return {
    title: task.title,
    description: task.description,
    priority: task.priority,
    estimatedEffort: String(task.estimatedEffort),
    category: task.category,
    dependencies: [...task.dependencies],
    status: task.status,
  };
}

export function useTaskForm(task: Task | null) {
  const [values, setValues] = useState<TaskFormValues>(() => toFormValues(task));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const setField = <K extends keyof TaskFormValues>(
    key: K,
    value: TaskFormValues[K],
  ) => {
    setValues((current) => ({ ...current, [key]: value }));

    // Clear the error for the field as soon as the user starts editing it.
    setFieldErrors((current) => {
      if (!current[key]) return current;

      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  /**
   * Validates the form locally before submit.
   *
   * These checks mirror the server schema but are only meant to improve the
   * editing experience.
   */
  const validate = (): boolean => {
    const errors: FieldErrors = {};

    if (!values.title.trim()) {
      errors.title = 'Title is required';
    } else if (values.title.trim().length > 200) {
      errors.title = 'Title cannot exceed 200 characters';
    }

    if (!values.category.trim()) {
      errors.category = 'Category is required';
    }

    const effort = Number(values.estimatedEffort);

    if (values.estimatedEffort.trim() === '' || Number.isNaN(effort)) {
      errors.estimatedEffort = 'Effort must be a number';
    } else if (effort <= 0) {
      errors.estimatedEffort = 'Effort must be greater than zero';
    } else if (effort > 1000) {
      errors.estimatedEffort = 'Effort cannot exceed 1000';
    }

    setFieldErrors(errors);

    return Object.keys(errors).length === 0;
  };

  return {
    values,
    setField,
    fieldErrors,
    /** Exposed so server-side validation errors can be mapped back to the form. */
    setFieldErrors,
    validate,
  };
}
