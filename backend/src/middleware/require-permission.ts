import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/api-error";
import type { AuthUser } from "../types/auth";

/**
 * Permissions by role.
 * - admin: full access.
 * - staff: full lab billing / test workflow access.
 * - operator: may view bills and samples, may create bills, but cannot
 *   cancel bills, collect dues, or enter/update results.
 *
 * `patient.delete` is deliberately absent for `operator`: archiving a
 * registration is a registry-level action.
 */
const ROLE_PERMISSIONS: Record<AuthUser["role"], readonly string[]> = {
  admin: [
    "patient.delete",
    "billing.view",
    "billing.create",
    "billing.cancel",
    "billing.collect_due",
    "billing.modify",
    "sample.view",
    "sample.update",
    "test_results.view",
    "test_results.enter",
    "test_results.update",
    "reports.print",
    "reports.view",
    "reports.generated_bills",
    "reports.lab_summary",
    "reports.osp_registration",
    "reports.doctor_commission",
    "reports.collection",
    "reports.client_bills",
    "reports.dues",
    "reports.cancelled_bills",
    "reports.bill_collection",
    "reports.price_card",
    "reports.outside_sent",
    "database.view",
    "database.doctor.read",
    "database.doctor.write",
    "database.specialisation.read",
    "database.specialisation.write",
    "database.designation.read",
    "database.designation.write",
    "database.location.read",
    "database.location.write",
    "database.department.read",
    "database.department.write",
    "database.package.read",
    "database.package.write",
    "lab.test.read",
    "lab.test.write",
    "lab.parameter.read",
    "lab.parameter.write",
    // Clinical approval of a calculation formula is deliberately separate from
    // parameter write access: an ordinary lab write does not grant approval.
    "lab.calculation.approve",
    "lab.tariff.read",
    "lab.tariff.write",
    "lab.commission.read",
    "lab.commission.write",
    "lab.client_tariff.read",
    "lab.client_tariff.write",
    "whatsapp.send",
  ],
  staff: [
    "patient.delete",
    "billing.view",
    "billing.create",
    "billing.cancel",
    "billing.collect_due",
    "billing.modify",
    "sample.view",
    "sample.update",
    "test_results.view",
    "test_results.enter",
    "test_results.update",
    "reports.print",
    "reports.view",
    "reports.generated_bills",
    "reports.lab_summary",
    "reports.osp_registration",
    "reports.doctor_commission",
    "reports.collection",
    "reports.client_bills",
    "reports.dues",
    "reports.cancelled_bills",
    "reports.bill_collection",
    "reports.price_card",
    "reports.outside_sent",
    "database.view",
    "database.doctor.read",
    "database.doctor.write",
    "database.specialisation.read",
    "database.specialisation.write",
    "database.designation.read",
    "database.designation.write",
    "database.location.read",
    "database.location.write",
    "database.department.read",
    "database.department.write",
    "database.package.read",
    "database.package.write",
    "lab.test.read",
    "lab.test.write",
    "lab.parameter.read",
    "lab.parameter.write",
    "lab.tariff.read",
    "lab.tariff.write",
    "lab.commission.read",
    "lab.commission.write",
    "lab.client_tariff.read",
    "lab.client_tariff.write",
  ],
  operator: ["billing.view", "billing.create", "sample.view", "test_results.view"],
};

/** Clinical approval of a calculation binding; held by authorized roles only. */
export const CALCULATION_APPROVE_PERMISSION = "lab.calculation.approve";

/** Single source of truth for role permissions, reused by route middleware and
 * by handler-level checks such as calculation approval. */
export function roleHasPermission(role: AuthUser["role"], permission: string): boolean {
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission);
}

export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      return next(new ApiError(401, "Authentication required"));
    }

    if (!roleHasPermission(user.role, permission)) {
      return next(
        new ApiError(403, `Permission denied: ${permission} is not allowed for your role`),
      );
    }

    return next();
  };
}