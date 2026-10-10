/**
 * Shared master-data enumeration constants used by the Database modules.
 */

export const DEPARTMENT_TYPES = [
  "Lab & X-Ray",
  "Service",
  "Doctors",
  "Pharmacy",
  "Stores",
  "Inventory",
  "CRM",
] as const;
export type DepartmentType = (typeof DEPARTMENT_TYPES)[number];

export const PACKAGE_TYPES = ["Lab"] as const;
export type PackageType = (typeof PACKAGE_TYPES)[number];

export const DOCTOR_TYPES = [
  "General Practitioner",
  "Consultant",
  "Visiting Consultant",
  "Specialist",
  "Surgeon",
  "Physician",
] as const;
export type DoctorType = (typeof DOCTOR_TYPES)[number];

export const GENDERS = ["Male", "Female", "Other"] as const;
export type Gender = (typeof GENDERS)[number];

export const YES_NO_OPTIONS = ["Y", "N"] as const;
export type YesNo = (typeof YES_NO_OPTIONS)[number];

export const LOCATION_LEVEL_ORDER = ["country", "state", "district", "city"] as const;
export type LocationLevel = (typeof LOCATION_LEVEL_ORDER)[number];

/**
 * Parameter category selectable on the New Lab Test Parameter screen. Not a
 * clinical value — it only groups how a parameter is treated on the entry
 * screen.
 */
export const LAB_PARAMETER_TYPES = [
  "Normal",
  "Derived",
  "Calculated",
] as const;
export type LabParameterType = (typeof LAB_PARAMETER_TYPES)[number];

export const PARAMETER_REFERENCE_TYPE_OPTIONS = [
  { value: "GENERAL", label: "General Range" },
  { value: "GENDER_WISE", label: "Gender Wise Range" },
] as const;