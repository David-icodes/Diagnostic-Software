import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/http";
import {
  DEPARTMENT_TYPES,
  DOCTOR_TYPES,
  GENDERS,
  LAB_PARAMETER_TYPES,
  PACKAGE_TYPES,
  PARAMETER_REFERENCE_TYPE_OPTIONS,
  YES_NO_OPTIONS,
} from "../../constants/master-data";
import {
  GENDER_RANGE_GENDERS,
  PARAMETER_REFERENCE_SCOPES,
  PARAMETER_RESULT_TYPES,
} from "../../models/lab-test-parameter.model";

export const getDatabaseOptions = asyncHandler(async (_req: Request, res: Response) => {
  return sendSuccess(res, {
    departmentTypes: DEPARTMENT_TYPES,
    packageTypes: PACKAGE_TYPES,
    doctorTypes: DOCTOR_TYPES,
    genders: GENDERS,
    yesNoOptions: YES_NO_OPTIONS,
    parameterTypes: LAB_PARAMETER_TYPES,
    parameterResultTypes: PARAMETER_RESULT_TYPES,
    parameterReferenceTypes: PARAMETER_REFERENCE_TYPE_OPTIONS.map(
      (option) => option.value,
    ),
    parameterReferenceScopes: PARAMETER_REFERENCE_SCOPES,
    genderRangeGenders: GENDER_RANGE_GENDERS,
  });
});