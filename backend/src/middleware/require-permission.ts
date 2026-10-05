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

export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      return next(new ApiError(401, "Authentication required"));
    }

    const granted = ROLE_PERMISSIONS[user.role] ?? [];
    if (!granted.includes(permission)) {
      return next(
        new ApiError(403, `Permission denied: ${permission} is not allowed for your role`),
      );
    }

    return next();
  };
}