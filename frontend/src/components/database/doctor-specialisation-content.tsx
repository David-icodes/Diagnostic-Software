"use client";

import { Award } from "lucide-react";
import { MasterContent } from "@/components/database/master-content";
import {
  createSpecialisation,
  fetchSpecialisations,
  setSpecialisationActive,
  updateSpecialisation,
} from "@/services/database";

export function DoctorSpecialisationContent() {
  return (
    <MasterContent
      icon={Award}
      title="Doctor Specialisation"
      subtitle="Add and manage doctor specialisations"
      formTitle="Add New Specialisation"
      recordLabel="Specialisation"
      placeholder="e.g. Cardiologist"
      services={{
        fetch: fetchSpecialisations,
        create: createSpecialisation,
        update: updateSpecialisation,
        setActive: setSpecialisationActive,
      }}
    />
  );
}