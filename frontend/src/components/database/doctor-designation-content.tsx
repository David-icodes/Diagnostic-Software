"use client";

import { Briefcase } from "lucide-react";
import { MasterContent } from "@/components/database/master-content";
import {
  createDesignation,
  fetchDesignations,
  setDesignationActive,
  updateDesignation,
} from "@/services/database";

export function DoctorDesignationContent() {
  return (
    <MasterContent
      icon={Briefcase}
      title="Doctor Designation"
      subtitle="Add and manage doctor designations"
      formTitle="Add New Designation"
      recordLabel="Designation"
      placeholder="e.g. Senior Consultant"
      services={{
        fetch: fetchDesignations,
        create: createDesignation,
        update: updateDesignation,
        setActive: setDesignationActive,
      }}
    />
  );
}