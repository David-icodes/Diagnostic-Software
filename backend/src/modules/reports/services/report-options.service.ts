import { User } from "../../../models/user.model";
import { billTypeOptions, payModeOptions } from "../utils/report-labels";
import type { ReportOptionsResult } from "../types/report-options";

export async function getReportOptions(): Promise<ReportOptionsResult> {
  const users = await User.find({ status: "active" })
    .select("name")
    .sort({ name: 1 })
    .exec();

  return {
    billTypes: billTypeOptions(),
    payModes: payModeOptions(),
    collectedByUsers: users.map((user) => ({
      id: String(user._id),
      name: user.name,
    })),
    priceCard: {
      serviceTypes: [{ value: "lab-test", label: "Lab Test" }],
      labNames: [{ value: "main", label: "Anjali Diagnostics" }],
      statuses: [
        { value: "all", label: "All" },
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" },
      ],
    },
  };
}